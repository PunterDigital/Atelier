import { toNextJsHandler } from "better-auth/next-js";

import { getAuth } from "@/server/auth";

// Wrapped per-request so the auth instance (and its DB pool) is never
// created at build time.
export const GET = (req: Request) => toNextJsHandler(getAuth()).GET(req);
export const POST = (req: Request) => toNextJsHandler(getAuth()).POST(req);
