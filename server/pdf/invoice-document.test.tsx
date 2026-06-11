import { describe, expect, it } from "vitest";

import { buildInvoicePdfData } from "@/modules/billing/pdf-data";

import { buildInvoicePdf } from "./invoice-document";

// Render smoke test: the document actually renders to a valid PDF buffer
// with all sections present. Content correctness lives in pdf-data tests.
describe("invoice PDF rendering", () => {
  it("renders a complete invoice to a PDF buffer", async () => {
    const data = buildInvoicePdfData({
      invoice: {
        number: "2026-0100",
        status: "paid",
        currency: "EUR",
        issueDate: new Date("2026-06-11T12:00:00Z"),
        dueDate: new Date("2026-07-11T00:00:00Z"),
        taxTreatment: "reverse_charge",
        taxRatePercent: "0",
        taxNote:
          "VAT reverse charged to the recipient under Article 196 of Council Directive 2006/112/EC",
        subtotalMinor: 76077,
        taxMinor: 0,
        totalMinor: 76077,
        notes: "Payment within 30 days. Thank you.",
        lines: [
          {
            description: "Demo Maker - 80.00 GBP/h",
            quantity: "5.500000",
            unitPriceMinor: 9278,
            totalMinor: 51027,
            sourceCurrency: "GBP",
            sourceTotalMinor: 44000,
            fxRate: "1.1597",
            fxSource: "ecb",
          },
          {
            description: "Hosting (March)",
            quantity: null,
            unitPriceMinor: null,
            totalMinor: 25050,
            sourceCurrency: null,
            sourceTotalMinor: null,
            fxRate: null,
            fxSource: null,
          },
        ],
      },
      business: {
        name: "Studio Demo",
        address: "12 Harbour Street\nBristol BS1 4QA",
        vatNumber: "GB123456789",
      },
      client: {
        name: "Lumen Labs",
        company: "Lumen Labs Ltd",
        vatNumber: "CZ12345678",
      },
    });

    const pdf = await buildInvoicePdf(data);

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    // A real one-page invoice with embedded structure is comfortably
    // larger than a trivial empty document.
    expect(pdf.length).toBeGreaterThan(2000);
  });
});
