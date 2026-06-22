import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  convertMinor,
  lineTotalMinorFromSeconds,
  parseDecimal,
  roundHalfUpDiv,
  subtotalMinor,
  taxMinor,
  toEffectiveHourlyMinor,
} from "./money";

const fixture = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL("../../fixtures/billing/cases/money-rounding.json", import.meta.url),
    ),
    "utf8",
  ),
) as {
  expected: {
    lineTotalsFromSeconds: {
      case: string;
      durationSeconds: number;
      rateMinorPerHour: number;
      totalMinor: number;
    }[];
    tax: {
      case: string;
      subtotalMinor: number;
      ratePercent: string;
      taxMinor: number;
    }[];
    conversions: {
      case: string;
      amountMinor: number;
      rate: string;
      from: string;
      to: string;
      convertedMinor: number;
    }[];
    subtotals: { case: string; lineTotals: number[]; subtotalMinor: number }[];
  };
};

describe("money core (fixture: money-rounding.json)", () => {
  it("computes time-based line totals exactly (rounding point 1)", () => {
    for (const c of fixture.expected.lineTotalsFromSeconds) {
      expect(
        lineTotalMinorFromSeconds(c.durationSeconds, c.rateMinorPerHour),
        c.case,
      ).toBe(c.totalMinor);
    }
  });

  it("computes tax on the subtotal exactly (rounding point 2)", () => {
    for (const c of fixture.expected.tax) {
      expect(taxMinor(c.subtotalMinor, c.ratePercent), c.case).toBe(c.taxMinor);
    }
  });

  it("converts between currencies exactly (rounding point 3)", () => {
    for (const c of fixture.expected.conversions) {
      expect(convertMinor(c.amountMinor, c.rate, c.from, c.to), c.case).toBe(
        c.convertedMinor,
      );
    }
  });

  it("sums rounded line totals without re-rounding", () => {
    for (const c of fixture.expected.subtotals) {
      expect(subtotalMinor(c.lineTotals), c.case).toBe(c.subtotalMinor);
    }
  });
});

describe("money core guardrails", () => {
  it("rejects negative amounts (out of spec v1)", () => {
    expect(() => roundHalfUpDiv(-1n, 100n)).toThrow();
  });

  it("rejects malformed decimal strings instead of guessing", () => {
    for (const bad of ["1,5", "1.2.3", "-2", "1e5", "", "abc"]) {
      expect(() => parseDecimal(bad), bad).toThrow();
    }
  });

  it("rejects non-integer line totals in subtotals", () => {
    expect(() => subtotalMinor([100, 0.5])).toThrow();
    expect(() => subtotalMinor([100, -1])).toThrow();
  });
});

describe("toEffectiveHourlyMinor (day-rate conversion)", () => {
  it("returns an hourly rate unchanged", () => {
    expect(toEffectiveHourlyMinor(3100, "hour", 8)).toBe(3100);
  });

  it("divides a day rate by hours-per-day (exact)", () => {
    // EUR 240.00/day over an 8h day -> EUR 30.00/h
    expect(toEffectiveHourlyMinor(24000, "day", 8)).toBe(3000);
    // EUR 310.00/day over an 8h day -> EUR 38.75/h
    expect(toEffectiveHourlyMinor(31000, "day", 8)).toBe(3875);
  });

  it("rounds half-up when the division is not exact", () => {
    // EUR 240.00/day over a 7h day -> 3428.57.. -> 3429
    expect(toEffectiveHourlyMinor(24000, "day", 7)).toBe(3429);
  });

  it("ignores hours-per-day for an hourly rate", () => {
    expect(toEffectiveHourlyMinor(5000, "hour", 7)).toBe(5000);
  });

  it("rejects a non-positive hours-per-day for a day rate", () => {
    expect(() => toEffectiveHourlyMinor(24000, "day", 0)).toThrow();
    expect(() => toEffectiveHourlyMinor(24000, "day", -8)).toThrow();
  });
});
