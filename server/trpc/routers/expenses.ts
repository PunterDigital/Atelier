import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { getDb } from "@/db";
import {
  ReceiptScanError,
  scanReceipt,
} from "@/modules/expenses/ocr";
import {
  createExpense,
  deleteExpense,
  expenseInputSchema,
  expenseStatusSchema,
  getExpense,
  listExpenses,
  setExpenseStatus,
  updateExpense,
} from "@/modules/expenses/service";

import { createTRPCRouter, permissionProcedure } from "../init";

const expenseIdInput = z.object({ expenseId: z.string().uuid() });

// Scanning only accepts the image formats Groq vision can read - PDFs are
// excluded here even though they're valid receipts elsewhere in the form.
const scanReceiptInput = z.object({
  dataUrl: z
    .string()
    .regex(
      /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/,
      "Scanning supports PNG or JPEG images",
    )
    .max(2_000_000, "Receipt is too large to scan - keep it under ~1.5MB"),
  mimeType: z.enum(["image/png", "image/jpeg"]),
});

// An expense id from another business is indistinguishable from a missing
// record: the service scopes every query by ctx.businessId.
function found<T>(row: T | null): T {
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "No such expense" });
  }
  return row;
}

export const expensesRouter = createTRPCRouter({
  list: permissionProcedure("expenses.view")
    .input(
      z
        .object({
          status: expenseStatusSchema.optional(),
          search: z.string().optional(),
        })
        .optional(),
    )
    .query(({ ctx, input }) =>
      listExpenses(getDb(), ctx.businessId, {
        status: input?.status,
        search: input?.search,
      }),
    ),

  get: permissionProcedure("expenses.view")
    .input(expenseIdInput)
    .query(async ({ ctx, input }) =>
      found(await getExpense(getDb(), ctx.businessId, input.expenseId)),
    ),

  create: permissionProcedure("expenses.create")
    .input(expenseInputSchema)
    .mutation(({ ctx, input }) =>
      createExpense(getDb(), ctx.businessId, input),
    ),

  // Read a receipt image with Groq and return suggested fields for the form to
  // pre-fill. Gated on expenses.create: scanning is a shortcut to creating an
  // expense. Nothing is persisted here - the user reviews before saving.
  scanReceipt: permissionProcedure("expenses.create")
    .input(scanReceiptInput)
    .mutation(async ({ input }) => {
      try {
        return await scanReceipt(input);
      } catch (error) {
        if (error instanceof ReceiptScanError) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
        }
        throw error;
      }
    }),

  update: permissionProcedure("expenses.edit")
    .input(expenseIdInput.extend({ data: expenseInputSchema }))
    .mutation(async ({ ctx, input }) =>
      found(
        await updateExpense(getDb(), ctx.businessId, input.expenseId, input.data),
      ),
    ),

  setStatus: permissionProcedure("expenses.approve")
    .input(expenseIdInput.extend({ status: expenseStatusSchema }))
    .mutation(async ({ ctx, input }) =>
      found(
        await setExpenseStatus(
          getDb(),
          ctx.businessId,
          input.expenseId,
          input.status,
        ),
      ),
    ),

  delete: permissionProcedure("expenses.delete")
    .input(expenseIdInput)
    .mutation(async ({ ctx, input }) =>
      found(await deleteExpense(getDb(), ctx.businessId, input.expenseId)),
    ),
});
