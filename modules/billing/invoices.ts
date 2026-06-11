import { and, eq, isNotNull, max, sql } from "drizzle-orm";

import type { Db } from "@/db";
import { schema } from "@/db";

import { invoiceTotals, type TaxTreatment } from "./tax";

// Invoice creation and numbering (billing spec Section 6).
// Numbers are YYYY-NNNN, sequential per business per calendar year,
// allocated inside the issuing transaction with the sequence row locked -
// no gaps, no duplicates, correct under concurrency. Drafts are
// unnumbered until issued.

export function formatInvoiceNumber(year: number, n: number): string {
  return `${year}-${String(n).padStart(4, "0")}`;
}

export async function createDraftInvoice(
  db: Db,
  businessId: string,
  input: {
    clientId: string;
    projectId?: string | null;
    currency: string;
    taxTreatment: TaxTreatment;
    standardRatePercent?: string;
    dueDate?: Date | null;
    notes?: string | null;
  },
) {
  // The client (and project, when given) must belong to the business.
  const [clientRow] = await db
    .select({ id: schema.client.id })
    .from(schema.client)
    .where(
      and(
        eq(schema.client.businessId, businessId),
        eq(schema.client.id, input.clientId),
      ),
    );
  if (!clientRow) {
    return null;
  }
  if (input.projectId) {
    const [projectRow] = await db
      .select({ id: schema.project.id, clientId: schema.project.clientId })
      .from(schema.project)
      .where(
        and(
          eq(schema.project.businessId, businessId),
          eq(schema.project.id, input.projectId),
        ),
      );
    if (!projectRow || projectRow.clientId !== input.clientId) {
      return null;
    }
  }

  // Empty totals now; lines recompute them. Validates the treatment/rate
  // combination immediately so a misconfigured draft cannot exist.
  const totals = invoiceTotals({
    lineTotalsMinor: [],
    treatment: input.taxTreatment,
    standardRatePercent: input.standardRatePercent,
  });

  const [created] = await db
    .insert(schema.invoice)
    .values({
      businessId,
      clientId: input.clientId,
      projectId: input.projectId ?? null,
      currency: input.currency,
      taxTreatment: input.taxTreatment,
      taxRatePercent: totals.taxRatePercent,
      taxNote: totals.taxNote,
      dueDate: input.dueDate ?? null,
      notes: input.notes ?? null,
    })
    .returning();
  return created;
}

// Issues a draft: allocates the next number for (business, issue year)
// under a row lock and stamps number, year, issue date and status in the
// same transaction.
export async function issueInvoice(
  db: Db,
  businessId: string,
  invoiceId: string,
  issueDate: Date = new Date(),
) {
  const year = issueDate.getUTCFullYear();

  return db.transaction(async (tx) => {
    const [draft] = await tx
      .select({ id: schema.invoice.id, status: schema.invoice.status })
      .from(schema.invoice)
      .where(
        and(
          eq(schema.invoice.businessId, businessId),
          eq(schema.invoice.id, invoiceId),
        ),
      )
      .for("update");
    if (!draft || draft.status !== "draft") {
      return null;
    }

    // Ensure the sequence row exists, then lock it for this transaction.
    await tx
      .insert(schema.invoiceSequence)
      .values({ businessId, year })
      .onConflictDoNothing();
    const [seq] = await tx
      .select()
      .from(schema.invoiceSequence)
      .where(
        and(
          eq(schema.invoiceSequence.businessId, businessId),
          eq(schema.invoiceSequence.year, year),
        ),
      )
      .for("update");

    const allocated = seq.nextNumber;
    await tx
      .update(schema.invoiceSequence)
      .set({ nextNumber: allocated + 1, updatedAt: new Date() })
      .where(eq(schema.invoiceSequence.id, seq.id));

    const [issued] = await tx
      .update(schema.invoice)
      .set({
        status: "sent",
        number: formatInvoiceNumber(year, allocated),
        year,
        issueDate,
        updatedAt: new Date(),
      })
      .where(eq(schema.invoice.id, invoiceId))
      .returning();
    return issued;
  });
}

// Spec Section 6 (Shay's review feedback): a migrating business can set
// where this year's sequence continues. The configured next number must
// exceed every number Atelier has already issued for that year.
export async function configureNextInvoiceNumber(
  db: Db,
  businessId: string,
  year: number,
  nextNumber: number,
) {
  if (!Number.isInteger(nextNumber) || nextNumber < 1 || nextNumber > 9999) {
    return { ok: false as const, reason: "Next number must be between 1 and 9999" };
  }
  return db.transaction(async (tx) => {
    const [highest] = await tx
      .select({
        value: max(
          sql<number>`cast(split_part(${schema.invoice.number}, '-', 2) as integer)`,
        ),
      })
      .from(schema.invoice)
      .where(
        and(
          eq(schema.invoice.businessId, businessId),
          eq(schema.invoice.year, year),
          isNotNull(schema.invoice.number),
        ),
      );
    // pg drivers return aggregates as strings; the cast keeps this exact.
    const issuedMax = Number(highest?.value ?? 0);
    if (nextNumber <= issuedMax) {
      return {
        ok: false as const,
        reason: `Already issued up to ${formatInvoiceNumber(year, issuedMax)} - the next number must be at least ${issuedMax + 1}`,
      };
    }
    await tx
      .insert(schema.invoiceSequence)
      .values({ businessId, year, nextNumber })
      .onConflictDoUpdate({
        target: [schema.invoiceSequence.businessId, schema.invoiceSequence.year],
        set: { nextNumber, updatedAt: new Date() },
      });
    return { ok: true as const };
  });
}
