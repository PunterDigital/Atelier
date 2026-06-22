import { z } from "zod";

import { getDb } from "@/db";
import {
  clientBudgetStatus,
  memberBudgetStatuses,
  projectBudgetStatus,
} from "@/modules/reports/budgets";
import { profitSummary } from "@/modules/reports/profit";

import { createTRPCRouter, permissionProcedure } from "../init";

// Profit is margin-sensitive (it exposes internal costs), so it sits behind
// reports.viewProfit. Budget burn-down is just tracked value vs a target -
// not sensitive - so it reuses the view permissions of the thing it measures.
export const reportsRouter = createTRPCRouter({
  profit: permissionProcedure("reports.viewProfit")
    .input(
      z
        .object({ from: z.date().optional(), to: z.date().optional() })
        .optional(),
    )
    .query(({ ctx, input }) =>
      profitSummary(getDb(), ctx.businessId, {
        from: input?.from,
        to: input?.to,
      }),
    ),

  clientBudget: permissionProcedure("clients.view")
    .input(z.object({ clientId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      clientBudgetStatus(getDb(), ctx.businessId, input.clientId),
    ),

  clientMemberBudgets: permissionProcedure("clients.view")
    .input(z.object({ clientId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      memberBudgetStatuses(getDb(), ctx.businessId, input.clientId),
    ),

  projectBudget: permissionProcedure("projects.view")
    .input(z.object({ projectId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      projectBudgetStatus(getDb(), ctx.businessId, input.projectId),
    ),
});
