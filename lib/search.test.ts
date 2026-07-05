import { describe, expect, it } from "vitest";

import { likeContains } from "./search";

describe("likeContains", () => {
  it("wraps the term in wildcards for a contains match", () => {
    expect(likeContains("acme")).toBe("%acme%");
  });

  it("escapes LIKE wildcards so they match literally", () => {
    // A term with % or _ must match those characters, not act as a
    // wildcard - otherwise "50%" would match anything containing "50".
    expect(likeContains("50%")).toBe("%50\\%%");
    expect(likeContains("a_b")).toBe("%a\\_b%");
  });

  it("escapes the escape character itself", () => {
    expect(likeContains("a\\b")).toBe("%a\\\\b%");
  });
});
