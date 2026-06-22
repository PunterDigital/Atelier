import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

import { PERMISSION_META, type Permission } from "@/modules/authz";
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
// from the caller's active membership, never from client input. The active
// business is the one the user has switched to (their userActiveBusiness
// pointer), falling back to their oldest membership - see getActiveMembership.
export const businessProcedure = authedProcedure.use(async ({ ctx, next }) => {
  const active = await getActiveMembership(ctx.session.user.id);
  if (!active) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Create a business first",
    });
  }
  return next({
    ctx: {
      ...ctx,
      businessId: active.businessId,
      businessMemberId: active.businessMemberId,
      // The stored role key ("owner".."viewer" or "custom"). Use it only for
      // ownership checks (=== "owner"); for everything else gate on
      // permissions below.
      businessRole: active.role,
      businessRoleId: active.customRoleId,
      roleName: active.roleName,
      // The caller's resolved permissions (role + per-member overrides).
      // Gate on this, never on businessRole directly - a member's individual
      // grants and denies only show up here.
      permissions: active.permissions,
    },
  });
});

// Throws FORBIDDEN unless the permission set holds `permission`. Use inside a
// businessProcedure when a single handler needs more than one permission, or
// when the gate is conditional; otherwise prefer permissionProcedure below.
export function requirePermission(
  permissions: ReadonlySet<Permission>,
  permission: Permission,
): void {
  if (!permissions.has(permission)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You don't have permission to ${PERMISSION_META[permission].label.toLowerCase()}`,
    });
  }
}

// The common case: a procedure that requires exactly one permission. Builds on
// businessProcedure, so it also carries the tenancy boundary and session.
export const permissionProcedure = (permission: Permission) =>
  businessProcedure.use(({ ctx, next }) => {
    requirePermission(ctx.permissions, permission);
    return next({ ctx });
  });
