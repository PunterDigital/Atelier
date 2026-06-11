import { describe, expect, it } from "vitest";

import { buildInvoicePdfData } from "./pdf-data";

const baseInvoice = {
  number: "2026-0100" as string | null,
  status: "sent" as const,
  currency: "EUR",
  issueDate: new Date("2026-06-11T12:00:00Z"),
  dueDate: new Date("2026-07-11T00:00:00Z"),
  taxTreatment: "standard" as const,
  taxRatePercent: "21",
  taxNote: null as string | null,
  subtotalMinor: 69750,
  taxMinor: 14648,
  totalMinor: 84398,
  notes: null as string | null,
  lines: [
    {
      description: "Demo Maker - 62.00 EUR/h",
      quantity: "11.250000" as string | null,
      unitPriceMinor: 6200 as number | null,
      totalMinor: 69750,
      sourceCurrency: null as string | null,
      sourceTotalMinor: null as number | null,
      fxRate: null as string | null,
      fxSource: null as "ecb" | "manual" | null,
    },
  ],
};

const business = { name: "Studio Demo", vatNumber: "GB123456789" };
const client = {
  name: "Northwind Studio",
  company: "Northwind Studio s.r.o.",
  vatNumber: "CZ12345678",
};

describe("invoice PDF view model", () => {
  it("labels an issued standard-rate invoice with both VAT numbers", () => {
    const data = buildInvoicePdfData({ invoice: baseInvoice, business, client });
    expect(data.title).toBe("Invoice 2026-0100");
    expect(data.isDraft).toBe(false);
    expect(data.businessVatNumber).toBe("GB123456789");
    expect(data.clientVatNumber).toBe("CZ12345678");
    expect(data.issueDateLabel).toBe("11 Jun 2026");
    expect(data.dueDateLabel).toBe("11 Jul 2026");
    expect(data.lines[0].quantityLabel).toBe("11.25 h x €62.00/h");
    expect(data.lines[0].totalLabel).toBe("€697.50");
    expect(data.taxRowLabel).toBe("VAT (21%)");
    expect(data.taxAmountLabel).toBe("€146.48");
    expect(data.totalLabel).toBe("€843.98");
  });

  it("labels drafts as drafts and fixed lines without quantity", () => {
    const data = buildInvoicePdfData({
      invoice: {
        ...baseInvoice,
        number: null,
        status: "draft",
        issueDate: null,
        lines: [
          {
            ...baseInvoice.lines[0],
            description: "Discovery workshop (fixed fee)",
            quantity: null,
            unitPriceMinor: null,
            totalMinor: 150000,
          },
        ],
      },
      business,
      client,
    });
    expect(data.title).toBe("Draft invoice");
    expect(data.isDraft).toBe(true);
    expect(data.issueDateLabel).toBeNull();
    expect(data.lines[0].quantityLabel).toBeNull();
    expect(data.lines[0].totalLabel).toBe("€1,500.00");
  });

  it("carries conversion notes and the reverse-charge tax note", () => {
    const data = buildInvoicePdfData({
      invoice: {
        ...baseInvoice,
        taxTreatment: "reverse_charge",
        taxRatePercent: "0",
        taxNote:
          "VAT reverse charged to the recipient under Article 196 of Council Directive 2006/112/EC",
        taxMinor: 0,
        lines: [
          {
            ...baseInvoice.lines[0],
            sourceCurrency: "GBP",
            sourceTotalMinor: 44000,
            fxRate: "1.1597",
            fxSource: "ecb",
          },
        ],
      },
      business,
      client,
    });
    expect(data.lines[0].conversionNote).toBe(
      "Converted from £440.00 at 1.1597 (ECB rate)",
    );
    expect(data.taxRowLabel).toBe("VAT");
    expect(data.taxNote).toContain("Article 196");
  });
});
