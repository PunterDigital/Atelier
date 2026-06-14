import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { withMcpAuth } from "better-auth/plugins";

import { getAuth } from "@/server/auth";
import { createAtelierCaller, mcpContextForUser } from "@/server/mcp/caller";
import { createAtelierMcpServer } from "@/server/mcp/server";
import { getActiveMembership } from "@/server/membership";

// The MCP protected resource. withMcpAuth validates the OAuth bearer token
// (via the Better Auth `mcp` plugin) and rejects unauthenticated requests
// with a 401 that points clients at the protected-resource metadata, kicking
// off the OAuth flow. Authenticated requests are dispatched to a per-request
// MCP server bound to a tRPC caller scoped to the user's active business.
//
// getAuth() is resolved per request (never at module load) so the build and
// Docker builder stage never instantiate the DB-backed auth instance.
async function handle(req: Request): Promise<Response> {
  const auth = getAuth();
  return withMcpAuth(auth, async (request, session) => {
    const membership = await getActiveMembership(session.userId);
    if (!membership) {
      // Authenticated but the user has no business yet: a clear 403 rather
      // than an opaque tool failure.
      return Response.json(
        { error: "no_business", message: "Create a business first." },
        { status: 403 },
      );
    }

    const caller = createAtelierCaller(
      mcpContextForUser(session.userId, request.headers),
    );
    const server = createAtelierMcpServer({
      caller,
      businessId: membership.businessId,
      baseUrl: new URL(request.url).origin,
    });

    // Stateless: a fresh server + transport per request, JSON responses (no
    // long-lived SSE session to track across the serverless boundary).
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    try {
      return await transport.handleRequest(request);
    } finally {
      await transport.close();
      await server.close();
    }
  })(req);
}

export { handle as GET, handle as POST, handle as DELETE };
