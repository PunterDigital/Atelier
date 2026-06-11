// View model for the invoice PDF: every string the document renders,
// built here so it is unit-testable without rendering. The PDF layer
// only lays out what this produces.

import { formatDateFull, formatMoney } from "@/lib/format";

type InvoiceRecord = {
  number: string | null;
  status: "draft" | "sent" | "paid" | "overdue";
  currency: string;
  issueDate: Date | null;
  dueDate: Date | null;
  taxTreatment: "standard" | "zero_rated" | "reverse_charge";
  taxRatePercent: string;
  taxNote: string | null;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  notes: string | null;
  lines: {
    description: string;
    quantity: string | null;
    unitPriceMinor: number | null;
    totalMinor: number;
    sourceCurrency: string | null;
    sourceTotalMinor: number | null;
    fxRate: string | null;
    fxSource: "ecb" | "manual" | null;
  }[];
};

export type InvoicePdfData = {
  title: string;
  isDraft: boolean;
  isPaid: boolean;
  businessName: string;
  businessAddressLines: string[];
  businessVatNumber: string | null;
  clientName: string;
  clientCompany: string | null;
  clientVatNumber: string | null;
  issueDateLabel: string | null;
  dueDateLabel: string | null;
  lines: {
    description: string;
    quantityLabel: string | null;
    totalLabel: string;
    conversionNote: string | null;
  }[];
  subtotalLabel: string;
  taxRowLabel: string;
  taxAmountLabel: string;
  totalLabel: string;
  taxNote: string | null;
  notes: string | null;
};

export function buildInvoicePdfData(input: {
  invoice: InvoiceRecord;
  business: { name: string; address: string | null; vatNumber: string | null };
  client: { name: string; company: string | null; vatNumber: string | null };
}): InvoicePdfData {
  const { invoice, business, client } = input;
  const isDraft = invoice.status === "draft";

  return {
    title: isDraft ? "Draft invoice" : `Invoice ${invoice.number}`,
    isDraft,
    isPaid: invoice.status === "paid",
    businessName: business.name,
    businessAddressLines: business.address
      ? business.address
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
      : [],
    businessVatNumber: business.vatNumber,
    clientName: client.name,
    clientCompany: client.company,
    clientVatNumber: client.vatNumber,
    issueDateLabel: invoice.issueDate
      ? formatDateFull(invoice.issueDate)
      : null,
    dueDateLabel: invoice.dueDate ? formatDateFull(invoice.dueDate) : null,
    lines: invoice.lines.map((line) => ({
      description: line.description,
      quantityLabel:
        line.quantity !== null && line.unitPriceMinor !== null
          ? `${Number(line.quantity).toFixed(2)} h x ${formatMoney(
              line.unitPriceMinor,
              invoice.currency,
            )}/h`
          : null,
      totalLabel: formatMoney(line.totalMinor, invoice.currency),
      conversionNote:
        line.sourceCurrency && line.sourceTotalMinor !== null && line.fxRate
          ? `Converted from ${formatMoney(
              line.sourceTotalMinor,
              line.sourceCurrency,
            )} at ${line.fxRate} (${line.fxSource === "ecb" ? "ECB" : "agreed"} rate)`
          : null,
    })),
    subtotalLabel: formatMoney(invoice.subtotalMinor, invoice.currency),
    taxRowLabel:
      invoice.taxTreatment === "standard"
        ? `VAT (${invoice.taxRatePercent}%)`
        : "VAT",
    taxAmountLabel: formatMoney(invoice.taxMinor, invoice.currency),
    totalLabel: formatMoney(invoice.totalMinor, invoice.currency),
    taxNote: invoice.taxNote,
    notes: invoice.notes,
  };
}
