import { describe, expect, it } from "vitest";

import { compareVersions, RELEASE_TAG } from "./semver";

describe("compareVersions", () => {
  it("says newer, older or equal for plain X.Y.Z versions", () => {
    expect(compareVersions("1.4.0", "1.3.1")).toBeGreaterThan(0);
    expect(compareVersions("1.3.1", "1.4.0")).toBeLessThan(0);
    expect(compareVersions("1.3.1", "1.3.1")).toBe(0);
  });

  it("compares each segment numerically, not lexically", () => {
    // A naive string compare would put "1.10.0" before "1.9.0".
    expect(compareVersions("1.10.0", "1.9.0")).toBeGreaterThan(0);
  });

  it("treats a missing trailing segment as zero", () => {
    expect(compareVersions("1.3", "1.3.0")).toBe(0);
    expect(compareVersions("1.3.1", "1.3")).toBeGreaterThan(0);
  });
});

describe("RELEASE_TAG", () => {
  it("matches plain release tags only", () => {
    expect(RELEASE_TAG.test("1.3.1")).toBe(true);
    expect(RELEASE_TAG.test("latest")).toBe(false);
    expect(RELEASE_TAG.test("1.3")).toBe(false);
    expect(RELEASE_TAG.test("sha-4c07c98")).toBe(false);
    expect(RELEASE_TAG.test("1.3.1-rc1")).toBe(false);
  });
});
