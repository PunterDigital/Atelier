import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("flex", "items-center")).toBe("flex items-center");
  });

  it("drops falsy conditional classes", () => {
    expect(cn("flex", false, undefined, null, "gap-2")).toBe("flex gap-2");
  });

  it("lets the later Tailwind utility win a conflict", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-left", "text-center")).toBe("text-center");
  });
});
