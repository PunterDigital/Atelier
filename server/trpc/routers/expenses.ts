import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { getDb } from "@/db";
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
    .input(z.object({ status: expenseStatusSchema.optional() }).optional())
    .query(({ ctx, input }) =>
      listExpenses(getDb(), ctx.businessId, { status: input?.status }),
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
