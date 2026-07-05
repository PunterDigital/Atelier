import { and, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/db";
import { schema } from "@/db";
import { likeContains } from "@/lib/search";

// Every function takes the caller's businessId and applies it to every
// query. An expense id from another business behaves exactly like a missing
// record - the tenancy boundary is structural, never trusted from input.

// A receipt is a base64 data URL (PNG/JPEG/PDF) stored inline, capped so an
// oversized upload can't bloat the row. ~2MB of base64 is roughly a 1.5MB
// source file. The cap mirrors the branding logo's intent (no blob store
// when self-hosting), just larger because receipts are often photos or PDFs.
const RECEIPT_MAX_BYTES = 2_000_000;

export const receiptSchema = z.object({
  dataUrl: z
    .string()
    .regex(
      /^data:(image\/(png|jpeg)|application\/pdf);base64,[A-Za-z0-9+/]+=*$/,
      "Receipt must be a PNG, JPEG or PDF",
    )
    .max(RECEIPT_MAX_BYTES, "Receipt is too large - keep it under ~1.5MB"),
  filename: z.string().trim().min(1).max(255),
  mimeType: z.enum(["image/png", "image/jpeg", "application/pdf"]),
});

export const expenseInputSchema = z.object({
  description: z.string().trim().min(1).max(500),
  // Minor units (integer), consistent with the rest of the money model.
  amountMinor: z.number().int().positive(),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Use a three-letter currency code like EUR"),
  vendor: z.string().trim().max(200).nullable().optional(),
  category: z.string().trim().max(100).nullable().optional(),
  incurredAt: z.date(),
  notes: z.string().trim().max(10_000).nullable().optional(),
  // Three states on update: omitted (undefined) keeps the existing receipt,
  // null clears it, an object replaces it. On create, omitted/null means no
  // receipt.
  receipt: receiptSchema.nullable().optional(),
});

export type ExpenseInput = z.infer<typeof expenseInputSchema>;

export const expenseStatusSchema = z.enum(["unpaid", "paid"]);
export type ExpenseStatus = z.infer<typeof expenseStatusSchema>;

// Columns returned by the list query: everything except the (potentially
// large) receipt data URL. receiptFilename is kept so the UI can flag which
// expenses have a receipt attached without shipping the bytes.
const listColumns = {
  id: schema.expense.id,
  description: schema.expense.description,
  amountMinor: schema.expense.amountMinor,
  currency: schema.expense.currency,
  vendor: schema.expense.vendor,
  category: schema.expense.category,
  status: schema.expense.status,
  incurredAt: schema.expense.incurredAt,
  paidAt: schema.expense.paidAt,
  receiptFilename: schema.expense.receiptFilename,
  createdAt: schema.expense.createdAt,
  updatedAt: schema.expense.updatedAt,
};

export async function listExpenses(
  db: Db,
  businessId: string,
  opts: { status?: ExpenseStatus; search?: string } = {},
) {
  const filters = [eq(schema.expense.businessId, businessId)];
  if (opts.status) {
    filters.push(eq(schema.expense.status, opts.status));
  }
  // Match on the description, vendor, or category.
  const term = opts.search?.trim();
  if (term) {
    const pattern = likeContains(term);
    filters.push(
      or(
        ilike(schema.expense.description, pattern),
        ilike(schema.expense.vendor, pattern),
        ilike(schema.expense.category, pattern),
      )!,
    );
  }
  return db
    .select(listColumns)
    .from(schema.expense)
    .where(and(...filters))
    // Newest cost first; created_at breaks ties for same-day entries.
    .orderBy(desc(schema.expense.incurredAt), desc(schema.expense.createdAt));
}

// The full row, including the receipt data URL - only fetched one at a time.
export async function getExpense(
  db: Db,
  businessId: string,
  expenseId: string,
) {
  const [row] = await db
    .select()
    .from(schema.expense)
    .where(
      and(
        eq(schema.expense.businessId, businessId),
        eq(schema.expense.id, expenseId),
      ),
    );
  return row ?? null;
}

function receiptColumns(receipt: ExpenseInput["receipt"]) {
  if (receipt == null) {
    return {
      receiptDataUrl: null,
      receiptFilename: null,
      receiptMimeType: null,
    };
  }
  return {
    receiptDataUrl: receipt.dataUrl,
    receiptFilename: receipt.filename,
    receiptMimeType: receipt.mimeType,
  };
}

export async function createExpense(
  db: Db,
  businessId: string,
  input: ExpenseInput,
) {
  const [created] = await db
    .insert(schema.expense)
    .values({
      businessId,
      description: input.description,
      amountMinor: input.amountMinor,
      currency: input.currency,
      vendor: input.vendor ?? null,
      category: input.category ?? null,
      incurredAt: input.incurredAt,
      notes: input.notes ?? null,
      ...receiptColumns(input.receipt),
    })
    .returning();
  return created;
}

export async function updateExpense(
  db: Db,
  businessId: string,
  expenseId: string,
  input: ExpenseInput,
) {
  // Leave the stored receipt untouched when the caller omits the field;
  // only replace or clear it when receipt is explicitly present.
  const receipt =
    input.receipt === undefined ? {} : receiptColumns(input.receipt);
  const [updated] = await db
    .update(schema.expense)
    .set({
      description: input.description,
      amountMinor: input.amountMinor,
      currency: input.currency,
      vendor: input.vendor ?? null,
      category: input.category ?? null,
      incurredAt: input.incurredAt,
      notes: input.notes ?? null,
      ...receipt,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.expense.businessId, businessId),
        eq(schema.expense.id, expenseId),
      ),
    )
    .returning();
  return updated ?? null;
}

// Mark paid/unpaid. paid_at is the audit point: stamped when paid, cleared
// when returned to unpaid so it never lingers as a false record.
export async function setExpenseStatus(
  db: Db,
  businessId: string,
  expenseId: string,
  status: ExpenseStatus,
) {
  const [updated] = await db
    .update(schema.expense)
    .set({
      status,
      paidAt: status === "paid" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.expense.businessId, businessId),
        eq(schema.expense.id, expenseId),
      ),
    )
    .returning();
  return updated ?? null;
}

export async function deleteExpense(
  db: Db,
  businessId: string,
  expenseId: string,
) {
  const [deleted] = await db
    .delete(schema.expense)
    .where(
      and(
        eq(schema.expense.businessId, businessId),
        eq(schema.expense.id, expenseId),
      ),
    )
    .returning();
  return deleted ?? null;
}
