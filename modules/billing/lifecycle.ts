// Invoice lifecycle (billing spec; statuses draft/sent/paid/overdue).
// draft -> sent happens in issueInvoice (numbering). sent -> overdue is
// flipped on read when the due date has passed - no background job yet,
// so reads are the source of truth and stay cheap and scoped. paid is a
// terminal state set explicitly.

import { and, desc, eq, lt } from "drizzle-orm";

import type { Db } from "@/db";
import { schema } from "@/db";

// Flips sent invoices past their due date to overdue for one business.
// Called by the read paths so a listed status is never stale.
export async function refreshOverdue(
  db: Db,
  businessId: string,
  now: Date = new Date(),
) {
  await db
    .update(schema.invoice)
    .set({ status: "overdue", updatedAt: now })
    .where(
      and(
        eq(schema.invoice.businessId, businessId),
        eq(schema.invoice.status, "sent"),
        lt(schema.invoice.dueDate, now),
      ),
    );
}

export async function listInvoices(
  db: Db,
  businessId: string,
  now: Date = new Date(),
) {
  await refreshOverdue(db, businessId, now);
  return db
    .select({
      id: schema.invoice.id,
      number: schema.invoice.number,
      status: schema.invoice.status,
      currency: schema.invoice.currency,
      totalMinor: schema.invoice.totalMinor,
      issueDate: schema.invoice.issueDate,
      dueDate: schema.invoice.dueDate,
      clientId: schema.invoice.clientId,
      clientName: schema.client.name,
      createdAt: schema.invoice.createdAt,
    })
    .from(schema.invoice)
    .innerJoin(schema.client, eq(schema.invoice.clientId, schema.client.id))
    .where(eq(schema.invoice.businessId, businessId))
    .orderBy(desc(schema.invoice.createdAt));
}

export async function getInvoice(
  db: Db,
  businessId: string,
  invoiceId: string,
  now: Date = new Date(),
) {
  await refreshOverdue(db, businessId, now);
  const [invoice] = await db
    .select()
    .from(schema.invoice)
    .where(
      and(
        eq(schema.invoice.businessId, businessId),
        eq(schema.invoice.id, invoiceId),
      ),
    );
  if (!invoice) {
    return null;
  }
  const lines = await db
    .select()
    .from(schema.invoiceLine)
    .where(eq(schema.invoiceLine.invoiceId, invoiceId))
    .orderBy(schema.invoiceLine.position);
  return { ...invoice, lines };
}

// sent or overdue -> paid. Drafts cannot be paid (they do not exist as
// documents yet) and paid is terminal.
export async function markInvoicePaid(
  db: Db,
  businessId: string,
  invoiceId: string,
) {
  const [updated] = await db
    .update(schema.invoice)
    .set({ status: "paid", updatedAt: new Date() })
    .where(
      and(
        eq(schema.invoice.businessId, businessId),
        eq(schema.invoice.id, invoiceId),
        // Guard in SQL so a concurrent transition cannot double-apply.
        eq(schema.invoice.status, "sent"),
      ),
    )
    .returning();
  if (updated) {
    return updated;
  }
  const [updatedOverdue] = await db
    .update(schema.invoice)
    .set({ status: "paid", updatedAt: new Date() })
    .where(
      and(
        eq(schema.invoice.businessId, businessId),
        eq(schema.invoice.id, invoiceId),
        eq(schema.invoice.status, "overdue"),
      ),
    )
    .returning();
  return updatedOverdue ?? null;
}
