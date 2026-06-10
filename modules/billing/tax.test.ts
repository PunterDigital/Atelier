import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { invoiceTotals, type TaxTreatment } from "./tax";

const fixture = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL("../../fixtures/billing/cases/invoice-totals.json", import.meta.url),
    ),
    "utf8",
  ),
) as {
  expected: {
    invoices: {
      case: string;
      lineTotalsMinor: number[];
      treatment: TaxTreatment;
      standardRatePercent?: string;
      subtotalMinor: number;
      taxMinor: number;
      totalMinor: number;
      taxNote: string | null;
    }[];
  };
};

describe("invoice totals (fixture: invoice-totals.json)", () => {
  it("matches every fixture invoice exactly, including notes", () => {
    for (const c of fixture.expected.invoices) {
      const result = invoiceTotals({
        lineTotalsMinor: c.lineTotalsMinor,
        treatment: c.treatment,
        standardRatePercent: c.standardRatePercent,
      });
      expect(result.subtotalMinor, `${c.case}: subtotal`).toBe(c.subtotalMinor);
      expect(result.taxMinor, `${c.case}: tax`).toBe(c.taxMinor);
      expect(result.totalMinor, `${c.case}: total`).toBe(c.totalMinor);
      expect(result.taxNote, `${c.case}: note`).toBe(c.taxNote);
    }
  });

  it("refuses a standard-rate invoice without a configured rate", () => {
    expect(() =>
      invoiceTotals({ lineTotalsMinor: [100], treatment: "standard" }),
    ).toThrow(/configured standard rate/);
  });
});
