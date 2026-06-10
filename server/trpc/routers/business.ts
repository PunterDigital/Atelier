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
});
