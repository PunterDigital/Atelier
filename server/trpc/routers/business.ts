import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "@/db";
import {
  authedProcedure,
  businessProcedure,
  createTRPCRouter,
} from "../init";

export const businessRouter = createTRPCRouter({
  // Onboarding: the signed-up user creates their business and becomes its
  // owner in one transaction. Currency is stored as an ISO 4217 code only -
  // no interpretation happens outside the billing module.
  create: authedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(200),
        currency: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z]{3}$/, "Use a three-letter currency code like EUR"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      return db.transaction(async (tx) => {
        const [created] = await tx
          .insert(schema.business)
          .values({ name: input.name, currency: input.currency })
          .returning();
        await tx.insert(schema.businessMember).values({
          businessId: created.id,
          userId: ctx.session.user.id,
          role: "owner",
        });
        return created;
      });
    }),

  current: businessProcedure.query(async ({ ctx }) => {
    const [row] = await getDb()
      .select({
        id: schema.business.id,
        name: schema.business.name,
        currency: schema.business.currency,
      })
      .from(schema.business)
      .where(eq(schema.business.id, ctx.businessId));
    return row;
  }),

  settings: businessProcedure.query(async ({ ctx }) => {
    const [row] = await getDb()
      .select({
        name: schema.business.name,
        address: schema.business.address,
        currency: schema.business.currency,
        taxConfig: schema.business.taxConfig,
      })
      .from(schema.business)
      .where(eq(schema.business.id, ctx.businessId));
    const taxConfig = (row?.taxConfig ?? {}) as {
      standardRatePct?: string;
      vatNumber?: string;
    };
    return {
      name: row.name,
      address: row.address,
      currency: row.currency,
      standardRatePct: taxConfig.standardRatePct ?? null,
      vatNumber: taxConfig.vatNumber ?? null,
    };
  }),

  updateSettings: businessProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(200),
        currency: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z]{3}$/, "Use a three-letter currency code like EUR"),
        // Stored verbatim into tax_config; the tax engine consumes it as
        // a decimal string (spec Section 4) and never defaults it.
        standardRatePct: z
          .string()
          .trim()
          .regex(/^\d+(\.\d+)?$/, "Use a plain number like 21 or 12.5")
          .nullable(),
        vatNumber: z.string().trim().max(30).nullable(),
        address: z.string().trim().max(500).nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.businessRole !== "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the business owner can change settings",
        });
      }
      const [updated] = await getDb()
        .update(schema.business)
        .set({
          name: input.name,
          address: input.address,
          currency: input.currency,
          taxConfig: {
            ...(input.standardRatePct
              ? { standardRatePct: input.standardRatePct }
              : {}),
            ...(input.vatNumber ? { vatNumber: input.vatNumber } : {}),
          },
          updatedAt: new Date(),
        })
        .where(eq(schema.business.id, ctx.businessId))
        .returning();
      return updated;
    }),
});
