/* Screenshot seed: layers invoices and recurring schedules on top of the base
   demo seed (db/seed.ts) so the invoicing and retainers screens have real
   content for the README screenshots. Idempotent: skips if invoices exist.

   Run AFTER pnpm db:seed, with DATABASE_URL pointing at the instance:
     pnpm exec tsx --env-file=.env db/seed-screenshots.ts */

import { eq } from "drizzle-orm";

import { getDb, schema } from "@/db";
import { createDraftInvoice, issueInvoice } from "@/modules/billing/invoices";
import {
  addManualLine,
  generateLinesFromUnbilledTime,
} from "@/modules/billing/generate";
import { markInvoicePaid } from "@/modules/billing/lifecycle";
import { createSchedule } from "@/modules/billing/recurring";

const DEMO_EMAIL = "demo@clerq.local";
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

async function main() {
  const db = getDb();

  const [user] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, DEMO_EMAIL));
  if (!user) {
    throw new Error("Base demo seed not applied - run `pnpm db:seed` first.");
  }
  const [membership] = await db
    .select({ businessId: schema.businessMember.businessId })
    .from(schema.businessMember)
    .where(eq(schema.businessMember.userId, user.id));
  const businessId = membership.businessId;

  const existing = await db
    .select({ id: schema.invoice.id })
    .from(schema.invoice)
    .where(eq(schema.invoice.businessId, businessId))
    .limit(1);
  if (existing.length > 0) {
    console.log("Screenshot data already present - nothing to do.");
    return;
  }

  // Fill in the business + client details that print on invoices.
  await db
    .update(schema.business)
    .set({
      address: "Studio Demo s.r.o.\nNa Perstyne 1\n110 00 Praha 1\nCzech Republic",
      taxConfig: { standardRatePct: "21", vatNumber: "CZ29040609" },
    })
    .where(eq(schema.business.id, businessId));

  const clients = await db
    .select()
    .from(schema.client)
    .where(eq(schema.client.businessId, businessId));
  const northwind = clients.find((c) => c.name.startsWith("Northwind"))!;
  const lumen = clients.find((c) => c.name.startsWith("Lumen"))!;

  await db
    .update(schema.client)
    .set({
      address: "Northwind Studio s.r.o.\nDlouha 12\n110 00 Praha 1\nCzech Republic",
      vatNumber: "CZ60193531",
    })
    .where(eq(schema.client.id, northwind.id));
  await db
    .update(schema.client)
    .set({
      address: "Lumen Labs Ltd\n40 Bermondsey Street\nLondon SE1 3UD\nUnited Kingdom",
      vatNumber: "GB402700113",
    })
    .where(eq(schema.client.id, lumen.id));

  // Invoice A: Northwind, EUR, standard VAT, billed from tracked time -> paid.
  const a = (await createDraftInvoice(db, businessId, {
    clientId: northwind.id,
    currency: "EUR",
    taxTreatment: "standard",
    standardRatePercent: "21",
    issueDate: d("2026-07-06"),
    dueDate: d("2026-07-20"),
  }))!;
  const genA = await generateLinesFromUnbilledTime(db, businessId, {
    invoiceId: a.id,
    grouping: "person_rate",
  });
  console.log("Invoice A lines:", genA);
  await issueInvoice(db, businessId, a.id, d("2026-07-06"));
  await markInvoicePaid(db, businessId, a.id);

  // Invoice B: Lumen, GBP, EU reverse-charge, billed from tracked time -> sent.
  const b = (await createDraftInvoice(db, businessId, {
    clientId: lumen.id,
    currency: "GBP",
    taxTreatment: "reverse_charge",
    issueDate: d("2026-07-01"),
    dueDate: d("2026-07-31"),
  }))!;
  const genB = await generateLinesFromUnbilledTime(db, businessId, {
    invoiceId: b.id,
    grouping: "person_rate",
  });
  console.log("Invoice B lines:", genB);
  const issuedB = await issueInvoice(db, businessId, b.id, d("2026-07-01"));
  console.log("Invoice B issued:", issuedB.ok);

  // Invoice C: Northwind, EUR, standard - a fixed-amount draft left in review.
  const c = (await createDraftInvoice(db, businessId, {
    clientId: northwind.id,
    currency: "EUR",
    taxTreatment: "standard",
    standardRatePercent: "21",
    issueDate: null,
    dueDate: d("2026-07-20"),
  }))!;
  await addManualLine(db, businessId, {
    invoiceId: c.id,
    description: "July support & maintenance retainer",
    amountMajor: "500",
  });

  // Recurring schedules (retainers), starting next month so the list shows
  // upcoming runs rather than back-billing on creation.
  const start = d("2026-08-01");
  await createSchedule(db, businessId, {
    clientId: northwind.id,
    name: "Website care plan",
    currency: "EUR",
    taxTreatment: "standard",
    frequency: "monthly",
    interval: 1,
    startDate: start,
    netTermsDays: 14,
    autoIssue: true,
    notes: "Hosting, backups, monthly updates and priority fixes.",
    lines: [{ description: "Website maintenance & hosting", amountMinor: 40000 }],
  });
  await createSchedule(db, businessId, {
    clientId: lumen.id,
    name: "Support & SLA retainer",
    currency: "GBP",
    taxTreatment: "reverse_charge",
    frequency: "monthly",
    interval: 1,
    startDate: start,
    netTermsDays: 30,
    autoIssue: false,
    notes: "20 hours priority support per month, 4-hour response SLA.",
    lines: [{ description: "Priority support retainer (20h)", amountMinor: 120000 }],
  });

  console.log("Seeded screenshot data: 3 invoices (paid / sent / draft), 2 retainers.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Screenshot seed failed:", error);
    process.exit(1);
  });
