import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { majorToMinor, minorToMajor, minorUnitDigits } from "./currency";

// Fixture-driven: the JSON states expected outputs
// exactly and the code must match them, not approximately.
const fixture = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        "../../fixtures/billing/cases/currency-minor-units.json",
        import.meta.url,
      ),
    ),
    "utf8",
  ),
) as {
  expected: {
    majorToMinor: { major: string; currency: string; minor: number }[];
    majorToMinorRejected: { major: string; currency: string }[];
    minorToMajor: { minor: number; currency: string; major: string }[];
    minorUnitDigits: { currency: string; digits: number }[];
  };
};

describe("currency minor units (fixture: currency-minor-units.json)", () => {
  it("converts major-unit input to exact minor units", () => {
    for (const c of fixture.expected.majorToMinor) {
      expect(majorToMinor(c.major, c.currency), `${c.major} ${c.currency}`).toBe(
        c.minor,
      );
    }
  });

  it("rejects input it cannot represent exactly", () => {
    for (const c of fixture.expected.majorToMinorRejected) {
      expect(
        majorToMinor(c.major, c.currency),
        `${c.major} ${c.currency}`,
      ).toBeNull();
    }
  });

  it("formats minor units back to major-unit strings", () => {
    for (const c of fixture.expected.minorToMajor) {
      expect(minorToMajor(c.minor, c.currency), `${c.minor} ${c.currency}`).toBe(
        c.major,
      );
    }
  });

  it("knows the ISO 4217 exponent per currency", () => {
    for (const c of fixture.expected.minorUnitDigits) {
      expect(minorUnitDigits(c.currency), c.currency).toBe(c.digits);
    }
  });
});
