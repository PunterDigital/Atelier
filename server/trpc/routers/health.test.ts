import { describe, expect, it } from "vitest";

import { createCallerFactory, type TRPCContext } from "../init";
import { appRouter } from "./_app";

// Context is constructed literally: the real createTRPCContext resolves a
// session against the database, which unit tests must not need.
const anonymousContext: TRPCContext = {
  headers: new Headers(),
  session: null,
};

describe("health router", () => {
  it("answers ping without a session - health stays public", async () => {
    const caller = createCallerFactory(appRouter)(anonymousContext);

    const result = await caller.health.ping();

    expect(result.ok).toBe(true);
    expect(result.time).toBeInstanceOf(Date);
  });
});
