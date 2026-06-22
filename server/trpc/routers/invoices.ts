import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "@/db";
import { fetchEcbRate } from "@/modules/billing/fx";
import {
  addManualLine,
  deleteInvoiceLine,
  generateLinesFromUnbilledTime,
} from "@/modules/billing/generate";
import {
  configureNextInvoiceNumber,
  createDraftInvoice,
  issueInvoice,
} from "@/modules/billing/invoices";
import {
  getInvoice,
  listInvoices,
  markInvoicePaid,
} from "@/modules/billing/lifecycle";

import { createTRPCRouter, permissionProcedure } from "../init";

function found<T>(row: T | null): T {
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "No such invoice" });
  }
  return row;
}

const treatmentSchema = z.enum(["standard", "zero_rated", "reverse_charge"]);

export const invoicesRouter = createTRPCRouter({
  list: permissionProcedure("invoices.view").query(({ ctx }) =>
    listInvoices(getDb(), ctx.businessId),
  ),

  get: permissionProcedure("invoices.view")
    .input(z.object({ invoiceId: z.string().uuid() }))
    .query(async ({ ctx, input }) =>
      found(await getInvoice(getDb(), ctx.businessId, input.invoiceId)),
    ),

  createDraft: permissionProcedure("invoices.create")
    .input(
      z.object({
        clientId: z.string().uuid(),
        projectId: z.string().uuid().optional(),
        currency: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z]{3}$/),
        taxTreatment: treatmentSchema,
        dueDate: z.date().nullable().optional(),
        periodStart: z.date().nullable().optional(),
        periodEnd: z.date().nullable().optional(),
      })
        // A billing period is a range: require both ends together and in
        // order, so a half-set period can never reach the PDF.
        .refine(
          (v) =>
            (v.periodStart == null) === (v.periodEnd == null) &&
            (v.periodStart == null ||
              v.periodEnd == null ||
              v.periodStart <= v.periodEnd),
          {
            message: "Give both billing-period dates, with the start on or before the end",
            path: ["periodEnd"],
          },
        ),
    )
    .mutation(async ({ ctx, input }) => {
      // The standard rate comes from tax_config only - the engine fails
      // loud when the treatment needs one and none is configured.
      const [businessRow] = await getDb()
        .select({ taxConfig: schema.business.taxConfig })
        .from(schema.business)
        .where(eq(schema.business.id, ctx.businessId));
      const taxConfig = (businessRow?.taxConfig ?? {}) as {
        standardRatePct?: string;
      };
      if (input.taxTreatment === "standard" && !taxConfig.standardRatePct) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Set your standard VAT rate in settings before creating a standard-rate invoice",
        });
      }
      return found(
        await createDraftInvoice(getDb(), ctx.businessId, {
          clientId: input.clientId,
          projectId: input.projectId ?? null,
          currency: input.currency,
          taxTreatment: input.taxTreatment,
          standardRatePercent: taxConfig.standardRatePct,
          dueDate: input.dueDate ?? null,
          periodStart: input.periodStart ?? null,
          periodEnd: input.periodEnd ?? null,
        }),
      );
    }),

  generateFromTime: permissionProcedure("invoices.edit")
    .input(
      z.object({
        invoiceId: z.string().uuid(),
        projectId: z.string().uuid().optional(),
        grouping: z.enum(["person_rate", "task", "single"]),
        includeTaskList: z.boolean().default(false),
        fxRates: z
          .record(
            z.string().regex(/^[A-Z]{3}$/),
            z.object({
              rate: z.string().regex(/^\d+(\.\d+)?$/),
              source: z.enum(["ecb", "manual"]),
            }),
          )
          .optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      generateLinesFromUnbilledTime(getDb(), ctx.businessId, input),
    ),

  // Server-side ECB lookup (keyless, no CORS) for the generate flow. The
  // chosen rate is only ever applied via generateFromTime's fxRates input,
  // so what the user confirmed is exactly what is stored.
  fetchRate: permissionProcedure("invoices.view")
    .input(
      z.object({
        from: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
        to: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
      }),
    )
    .query(({ input }) =>
      fetchEcbRate({ date: new Date(), from: input.from, to: input.to }),
    ),

  deleteLine: permissionProcedure("invoices.edit")
    .input(z.object({ lineId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) =>
      found(await deleteInvoiceLine(getDb(), ctx.businessId, input.lineId)),
    ),

  // Fixed-amount manual line - invoices are dual-purpose, not only
  // generated from time.
  addLine: permissionProcedure("invoices.edit")
    .input(
      z.object({
        invoiceId: z.string().uuid(),
        description: z.string().trim().min(1),
        amountMajor: z.string().trim().regex(/^\d+(\.\d+)?$/, "Enter a plain amount like 1500 or 1500.00"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await addManualLine(getDb(), ctx.businessId, input);
      if (!result.ok) {
        throw new TRPCError({
          code: result.reason === "bad_amount" ? "BAD_REQUEST" : "NOT_FOUND",
          message:
            result.reason === "bad_amount"
              ? "That amount has more decimal places than the invoice currency allows"
              : "Only draft invoices can be edited",
        });
      }
      return result.invoice;
    }),

  issue: permissionProcedure("invoices.issue")
    .input(z.object({ invoiceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await issueInvoice(getDb(), ctx.businessId, input.invoiceId);
      if (!result.ok) {
        if (result.reason === "missing_vat_numbers") {
          const parts = (result.missing ?? []).map((m) =>
            m === "business" ? "yours (in settings)" : "the client's (on their page)",
          );
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Reverse-charge invoices need both VAT numbers printed - add ${parts.join(" and ")}`,
          });
        }
        throw new TRPCError({ code: "NOT_FOUND", message: "No such invoice" });
      }
      return result.invoice;
    }),

  markPaid: permissionProcedure("invoices.markPaid")
    .input(z.object({ invoiceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) =>
      found(await markInvoicePaid(getDb(), ctx.businessId, input.invoiceId)),
    ),

  configureNextNumber: permissionProcedure("invoices.configure")
    .input(
      z.object({
        year: z.number().int().min(2000).max(2200),
        nextNumber: z.number().int(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await configureNextInvoiceNumber(
        getDb(),
        ctx.businessId,
        input.year,
        input.nextNumber,
      );
      if (!result.ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.reason });
      }
      return result;
    }),
});
