import "server-only";

import { headers } from "next/headers";

import { createCallerFactory, createTRPCContext } from "./init";
import { appRouter } from "./routers/_app";

// Direct server-side caller for React Server Components. Detached from the
// query client on purpose - RSC reads do not need hydration here yet.
export const caller = createCallerFactory(appRouter)(async () =>
  createTRPCContext({ headers: await headers() }),
);
