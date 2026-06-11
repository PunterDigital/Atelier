import { eq } from "drizzle-orm";

import { getDb, schema } from "@/db";
import { getInvoice } from "@/modules/billing/lifecycle";
import { buildInvoicePdfData } from "@/modules/billing/pdf-data";
import { getAuth } from "@/server/auth";
import { getActiveMembership } from "@/server/membership";
import { buildInvoicePdf } from "@/server/pdf/invoice-document";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  const session = await getAuth().api.getSession({ headers: req.headers });
  if (!session) {
    return new Response("Sign in first", { status: 401 });
  }
  const membership = await getActiveMembership(session.user.id);
  if (!membership) {
    return new Response("No business", { status: 403 });
  }

  const { invoiceId } = await params;
  const db = getDb();
  const invoice = await getInvoice(db, membership.businessId, invoiceId);
  if (!invoice) {
    return new Response("Not found", { status: 404 });
  }

  const [businessRow] = await db
    .select({ name: schema.business.name, taxConfig: schema.business.taxConfig })
    .from(schema.business)
    .where(eq(schema.business.id, membership.businessId));
  const [clientRow] = await db
    .select({
      name: schema.client.name,
      company: schema.client.company,
      vatNumber: schema.client.vatNumber,
    })
    .from(schema.client)
    .where(eq(schema.client.id, invoice.clientId));

  const data = buildInvoicePdfData({
    invoice,
    business: {
      name: businessRow.name,
      vatNumber:
        ((businessRow.taxConfig ?? {}) as { vatNumber?: string }).vatNumber ??
        null,
    },
    client: clientRow,
  });

  const pdf = await buildInvoicePdf(data);
  const filename = invoice.number
    ? `invoice-${invoice.number}.pdf`
    : "draft-invoice.pdf";
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
