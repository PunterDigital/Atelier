import { initTRPC } from "@trpc/server";
import superjson from "superjson";

// Context constraint: there is no session here yet on purpose. The auth
// design is human-gated (ESC-3 in ESCALATIONS.md); until it lands, only
// public procedures exist and nothing may assume an authenticated user or
// a business_id. The protected, business-scoped procedure helper is added
// together with the agreed auth design.
export const createTRPCContext = async (opts: { headers: Headers }) => {
  return {
    headers: opts.headers,
  };
};

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;
