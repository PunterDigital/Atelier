import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

import { getAuth, type Session } from "@/server/auth";
import { getActiveMembership } from "@/server/membership";

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await getAuth().api.getSession({ headers: opts.headers });
  return {
    headers: opts.headers,
    session: session as Session | null,
  };
};

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;

export const authedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in first" });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});

// The tenancy boundary: every business-scoped procedure derives business_id
// from the caller's membership, never from client input. Until multi-entity
// switching lands (Phase 4), the active business is the user's oldest
// membership - deterministic, and correct for the single-business case.
export const businessProcedure = authedProcedure.use(async ({ ctx, next }) => {
  const active = await getActiveMembership(ctx.session.user.id);
  if (!active) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Create a business first",
    });
  }
  return next({
    ctx: { ...ctx, businessId: active.businessId, businessRole: active.role },
  });
});
