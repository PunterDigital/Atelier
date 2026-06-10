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
