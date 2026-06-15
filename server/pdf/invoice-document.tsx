// The invoice PDF layout. Colors are the design system's tokens by value
// (PDFs cannot read CSS variables): teal-500 #228E80 primary, warm
// neutrals #2A241F/#6E6458 text, #E8E1D8 hairlines. Typeface is the PDF
// standard Helvetica for now - self-hosted Figtree embedding is part of
// the design pass.

import {
  Document,
  Image,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import type { InvoicePdfData } from "@/modules/billing/pdf-data";

// primary is the default; per-invoice it is overridden inline by the
// business's chosen brand colour (data.brandColor).
const colors = {
  primary: "#228E80",
  textStrong: "#2A241F",
  textMuted: "#6E6458",
  border: "#E8E1D8",
};

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: colors.textStrong,
    lineHeight: 1.5,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  businessName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    marginBottom: 5,
  },
  title: { fontSize: 22, fontFamily: "Helvetica-Bold", textAlign: "right" },
  paidBadge: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    textAlign: "right",
    marginTop: 2,
  },
  metaBlock: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  metaColumn: { maxWidth: "48%" },
  metaCaption: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  metaLine: { fontSize: 10 },
  metaMuted: { fontSize: 10, color: colors.textMuted },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 5,
    marginBottom: 2,
  },
  th: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 7,
  },
  cellDescription: { flex: 1, paddingRight: 12 },
  cellAmount: { width: 90, textAlign: "right" },
  lineNote: { fontSize: 8, color: colors.textMuted, marginTop: 1 },
  totals: {
    marginTop: 14,
    marginLeft: "auto",
    width: 220,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  totalsGrand: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 4,
    paddingTop: 6,
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
  },
  taxNote: { marginTop: 18, fontSize: 9, color: colors.textMuted },
  notes: { marginTop: 10, fontSize: 9, color: colors.textMuted },
  logo: { maxWidth: 180, height: 48, objectFit: "contain", marginBottom: 10 },
  footer: {
    position: "absolute",
    bottom: 36,
    left: 48,
    right: 48,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    fontSize: 8,
    color: colors.textMuted,
  },
});

export function InvoiceDocument({ data }: { data: InvoicePdfData }) {
  return (
    <Document
      title={data.title}
      author={data.businessName}
      creator="Clerq"
      producer="Clerq"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            {data.logoDataUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={data.logoDataUrl} style={styles.logo} />
            ) : null}
            <Text style={[styles.businessName, { color: data.brandColor }]}>
              {data.businessName}
            </Text>
            {data.businessAddressLines.map((line, index) => (
              <Text key={index} style={styles.metaMuted}>
                {line}
              </Text>
            ))}
            {data.businessVatNumber ? (
              <Text style={styles.metaMuted}>VAT {data.businessVatNumber}</Text>
            ) : null}
          </View>
          <View>
            <Text style={styles.title}>{data.title}</Text>
            {data.isPaid ? (
              <Text style={[styles.paidBadge, { color: data.brandColor }]}>
                Paid
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.metaBlock}>
          <View style={styles.metaColumn}>
            <Text style={styles.metaCaption}>Billed to</Text>
            <Text style={styles.metaLine}>{data.clientName}</Text>
            {data.clientCompany ? (
              <Text style={styles.metaLine}>{data.clientCompany}</Text>
            ) : null}
            {data.clientVatNumber ? (
              <Text style={styles.metaMuted}>VAT {data.clientVatNumber}</Text>
            ) : null}
          </View>
          <View style={styles.metaColumn}>
            {data.issueDateLabel ? (
              <>
                <Text style={styles.metaCaption}>Issued</Text>
                <Text style={styles.metaLine}>{data.issueDateLabel}</Text>
              </>
            ) : null}
            {data.dueDateLabel ? (
              <>
                <Text style={[styles.metaCaption, { marginTop: 8 }]}>Due</Text>
                <Text style={styles.metaLine}>{data.dueDateLabel}</Text>
              </>
            ) : null}
          </View>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.th, styles.cellDescription]}>Description</Text>
          <Text style={[styles.th, styles.cellAmount]}>Amount</Text>
        </View>
        {data.lines.map((line, index) => (
          <View key={index} style={styles.row} wrap={false}>
            <View style={styles.cellDescription}>
              <Text>{line.description}</Text>
              {line.quantityLabel ? (
                <Text style={styles.lineNote}>{line.quantityLabel}</Text>
              ) : null}
              {line.conversionNote ? (
                <Text style={styles.lineNote}>{line.conversionNote}</Text>
              ) : null}
            </View>
            <Text style={styles.cellAmount}>{line.totalLabel}</Text>
          </View>
        ))}

        <View style={styles.totals}>
          <View style={styles.totalsRow}>
            <Text style={styles.metaMuted}>Subtotal</Text>
            <Text>{data.subtotalLabel}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.metaMuted}>{data.taxRowLabel}</Text>
            <Text>{data.taxAmountLabel}</Text>
          </View>
          <View style={styles.totalsGrand}>
            <Text>Total</Text>
            <Text>{data.totalLabel}</Text>
          </View>
        </View>

        {data.taxNote ? <Text style={styles.taxNote}>{data.taxNote}</Text> : null}
        {data.notes ? <Text style={styles.notes}>{data.notes}</Text> : null}

        {data.footerNote ? (
          <Text style={styles.footer} fixed>
            {data.footerNote}
          </Text>
        ) : null}
      </Page>
    </Document>
  );
}

export function buildInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument data={data} />);
}
