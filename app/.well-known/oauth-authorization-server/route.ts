import { oAuthDiscoveryMetadata } from "better-auth/plugins";

import { getAuth } from "@/server/auth";

// RFC 8414 authorization-server metadata, served at the deployment root where
// MCP clients look for it. The Better Auth `mcp` plugin produces the document;
// getAuth() is deferred to request time to keep the build DB-free.
export const GET = (req: Request) => oAuthDiscoveryMetadata(getAuth())(req);
