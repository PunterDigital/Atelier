import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import { createCallerFactory, type TRPCContext } from "../init";
import { appRouter } from "./_app";

const anonymousContext: TRPCContext = {
  headers: new Headers(),
  session: null,
};

// The auth boundary: no procedure behind authedProcedure or
// businessProcedure may answer without a session. Cross-business isolation
// (the DB-level proof) lands with the clients module integration tests.
describe("auth boundary", () => {
  it("rejects business.create without a session", async () => {
    const caller = createCallerFactory(appRouter)(anonymousContext);

    await expect(
      caller.business.create({ name: "Test", currency: "EUR" }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    } satisfies Partial<TRPCError>);
  });

  it("rejects business.current without a session", async () => {
    const caller = createCallerFactory(appRouter)(anonymousContext);

    await expect(caller.business.current()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    } satisfies Partial<TRPCError>);
  });
});
