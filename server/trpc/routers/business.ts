import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "@/db";
import {
  authedProcedure,
  businessProcedure,
  createTRPCRouter,
} from "../init";

// Shape of the branding JSONB blob. Owned here: the logo is a base64 data
// URL (no blob store to run when self-hosting), the brand colour an #rrggbb
// hex, and the footer a short line printed at the foot of every invoice.
type Branding = {
  logoDataUrl?: string;
  brandColor?: string;
  footerNote?: string;
};

// A PNG/JPEG data URL, capped so an oversized image can't bloat the row or
// the invoice PDF. ~1.5MB of base64 is roughly a 1MB source image.
const logoDataUrlSchema = z
  .string()
  .trim()
  .regex(
    /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/,
    "Upload a PNG or JPEG image",
  )
  .max(1_500_000, "Logo image is too large - keep it under ~1MB")
  .nullable();

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
        branding: schema.business.branding,
      })
      .from(schema.business)
      .where(eq(schema.business.id, ctx.businessId));
    const taxConfig = (row?.taxConfig ?? {}) as {
      standardRatePct?: string;
      vatNumber?: string;
    };
    const branding = (row?.branding ?? {}) as Branding;
    return {
      name: row.name,
      address: row.address,
      currency: row.currency,
      standardRatePct: taxConfig.standardRatePct ?? null,
      vatNumber: taxConfig.vatNumber ?? null,
      logoDataUrl: branding.logoDataUrl ?? null,
      brandColor: branding.brandColor ?? null,
      footerNote: branding.footerNote ?? null,
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

  // Logo, brand colour and a short footer line for the invoice. Kept separate
  // from updateSettings so the (potentially large) logo only travels when the
  // appearance is actually changed. Owner-only, like the rest of settings.
  updateBranding: businessProcedure
    .input(
      z.object({
        logoDataUrl: logoDataUrlSchema,
        brandColor: z
          .string()
          .trim()
          .regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour like #228E80")
          .nullable(),
        footerNote: z.string().trim().max(280).nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.businessRole !== "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the business owner can change settings",
        });
      }
      // Read-modify-write so unknown keys the design system may add later
      // survive an appearance edit. Absent values drop the key entirely.
      const [current] = await getDb()
        .select({ branding: schema.business.branding })
        .from(schema.business)
        .where(eq(schema.business.id, ctx.businessId));
      const branding: Branding = { ...((current?.branding ?? {}) as Branding) };
      if (input.logoDataUrl) branding.logoDataUrl = input.logoDataUrl;
      else delete branding.logoDataUrl;
      if (input.brandColor) branding.brandColor = input.brandColor;
      else delete branding.brandColor;
      if (input.footerNote) branding.footerNote = input.footerNote;
      else delete branding.footerNote;

      const [updated] = await getDb()
        .update(schema.business)
        .set({ branding, updatedAt: new Date() })
        .where(eq(schema.business.id, ctx.businessId))
        .returning();
      return updated;
    }),
});
