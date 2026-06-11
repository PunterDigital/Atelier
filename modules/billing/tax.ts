// Tax engine per the approved billing spec, Section 4: exactly one
// treatment per invoice, tax computed once on the subtotal of rounded
// line totals. The three treatments and their mandatory notes are the
// whole v1 surface - anything else escalates before code.

import { subtotalMinor, taxMinor } from "./money";

export type TaxTreatment = "standard" | "zero_rated" | "reverse_charge";

export const TAX_NOTES: Record<Exclude<TaxTreatment, "standard">, string> = {
  zero_rated: "Zero-rated for VAT purposes",
  reverse_charge:
    "VAT reverse charged to the recipient under Article 196 of Council Directive 2006/112/EC",
};

export type InvoiceTotals = {
  subtotalMinor: number;
  taxRatePercent: string;
  taxMinor: number;
  totalMinor: number;
  taxNote: string | null;
};

export function invoiceTotals(input: {
  lineTotalsMinor: number[];
  treatment: TaxTreatment;
  // From the business's tax_config; required for the standard treatment.
  standardRatePercent?: string;
}): InvoiceTotals {
  const subtotal = subtotalMinor(input.lineTotalsMinor);

  if (input.treatment === "standard") {
    const rate = input.standardRatePercent;
    if (rate === undefined) {
      // Fail loud: a missing configured rate is a setup problem, never a
      // default we invent.
      throw new Error(
        "Standard-rate invoice without a configured standard rate (tax_config.standardRatePct)",
      );
    }
    const tax = taxMinor(subtotal, rate);
    return {
      subtotalMinor: subtotal,
      taxRatePercent: rate,
      taxMinor: tax,
      totalMinor: subtotal + tax,
      taxNote: null,
    };
  }

  return {
    subtotalMinor: subtotal,
    taxRatePercent: "0",
    taxMinor: 0,
    totalMinor: subtotal,
    taxNote: TAX_NOTES[input.treatment],
  };
}
