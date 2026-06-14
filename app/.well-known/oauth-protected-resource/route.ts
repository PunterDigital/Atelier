import { oAuthProtectedResourceMetadata } from "better-auth/plugins";

import { getAuth } from "@/server/auth";

// RFC 9728 protected-resource metadata: tells MCP clients which authorization
// server guards the /api/mcp resource. Served at the root; getAuth() deferred
// to request time so the build never instantiates the auth instance.
export const GET = (req: Request) =>
  oAuthProtectedResourceMetadata(getAuth())(req);
