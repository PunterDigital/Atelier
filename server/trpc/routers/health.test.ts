import { describe, expect, it } from "vitest";

import { createCallerFactory, createTRPCContext } from "../init";
import { appRouter } from "./_app";

// Exercises the real router through a real caller and context, so a broken
// context shape or router wiring fails here instead of at runtime.
describe("health router", () => {
  it("answers ping through the app router", async () => {
    const caller = createCallerFactory(appRouter)(
      await createTRPCContext({ headers: new Headers() }),
    );

    const result = await caller.health.ping();

    expect(result.ok).toBe(true);
    expect(result.time).toBeInstanceOf(Date);
  });
});
