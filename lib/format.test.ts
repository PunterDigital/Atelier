import { describe, expect, it } from "vitest";

import { formatMoney } from "./format";

describe("formatMoney", () => {
  it("separates the currency symbol from the amount with a non-breaking space", () => {
    // en-GB's CLDR data glues the symbol straight to the digits
    // ("€2,200.00") with no separator at all - regression coverage for
    // that boundary getting a space back.
    expect(formatMoney(220000, "EUR")).toBe("€ 2,200.00");
    expect(formatMoney(220000, "GBP")).toBe("£ 2,200.00");
    expect(formatMoney(220000, "USD")).toBe("US$ 2,200.00");
  });

  it("keeps the minus sign next to the symbol, not the amount", () => {
    expect(formatMoney(-220000, "EUR")).toBe("-€ 2,200.00");
  });

  it("does not double up a currency that already separates symbol and amount", () => {
    // en-GB already inserts its own non-breaking space for CHF.
    expect(formatMoney(123450, "CHF")).toBe("CHF 1,234.50");
  });
});
