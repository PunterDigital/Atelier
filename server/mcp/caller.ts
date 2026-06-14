import { createCallerFactory, type TRPCContext } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/routers/_app";
import type { Session } from "@/server/auth";

// The MCP tools run entirely through the tRPC caller, so every business rule,
// Zod validation and the business_id tenancy boundary is reused exactly as
// the web app enforces it - the MCP server adds no parallel data path.
export const createAtelierCaller = createCallerFactory(appRouter);

export type AtelierCaller = ReturnType<typeof createAtelierCaller>;

// Build a caller context for a user resolved from an MCP OAuth access token.
// businessProcedure derives business_id from ctx.session.user.id, so a minimal
// session carrying the user id is all the procedures need; the rest of the
// Better Auth session object is never read server-side.
export function mcpContextForUser(
  userId: string,
  headers: Headers,
): TRPCContext {
  const session = {
    user: { id: userId },
    session: {},
  } as unknown as Session;
  return { headers, session };
}
