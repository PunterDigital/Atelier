import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { schema, type Db } from "@/db";
import { createClient } from "@/modules/clients/service";
import { createProject } from "@/modules/projects/service";
import { createTask } from "@/modules/projects/tasks-service";
import { logManualEntry } from "@/modules/time/service";

import {
  addManualLine,
  deleteInvoiceLine,
  generateLinesFromUnbilledTime,
} from "./generate";
import { createDraftInvoice, issueInvoice } from "./invoices";

const migrationsFolder = fileURLToPath(
  new URL("../../db/migrations", import.meta.url),
);

let pglite: PGlite;
let db: Db;
let business: { id: string };
let client: { id: string };
let project: { id: string };
let task: { id: string };
const user = "user-a";

beforeAll(async () => {
  pglite = new PGlite();
  const pgliteDb = drizzle(pglite, { schema });
  await migrate(pgliteDb, { migrationsFolder });
  db = pgliteDb;

  [business] = await db
    .insert(schema.business)
    .values({
      name: "Alpha Studio",
      currency: "EUR",
      taxConfig: { standardRatePct: "21" },
    })
    .returning();
  await db
    .insert(schema.user)
    .values([{ id: user, name: "Shay", email: "shay@alpha.test" }]);
  client = await createClient(db, business.id, user, {
    name: "Northwind",
    contacts: [],
    defaultRateMinor: 6200,
    defaultRateCurrency: "EUR",
  });
  project = (await createProject(db, business.id, user, {
    name: "Website",
    clientId: client.id,
    status: "active",
  })) as { id: string };
  task = (await createTask(db, business.id, project.id, {
    title: "Homepage build",
    status: "in_progress",
  })) as { id: string };

  // 2h15m + 1h50m billable (the spec example), one non-billable.
  await logManualEntry(db, business.id, user, {
    taskId: task.id,
    startedAt: new Date("2026-06-08T09:00:00Z"),
    durationSeconds: 8100,
    billable: true,
  });
  await logManualEntry(db, business.id, user, {
    taskId: task.id,
    startedAt: new Date("2026-06-09T09:00:00Z"),
    durationSeconds: 6600,
    billable: true,
  });
  await logManualEntry(db, business.id, user, {
    taskId: task.id,
    startedAt: new Date("2026-06-09T13:00:00Z"),
    durationSeconds: 3600,
    billable: false,
  });
});

afterAll(async () => {
  await pglite.close();
});

describe("generate lines from unbilled time (integration)", () => {
  it("creates lines, links entries, computes totals, and releases on line removal", async () => {
    const draft = await createDraftInvoice(db, business.id, {
      clientId: client.id,
      currency: "EUR",
      taxTreatment: "standard",
      standardRatePercent: "21",
    });
    expect(draft).not.toBeNull();
    const invoiceId = (draft as { id: string }).id;

    const generated = await generateLinesFromUnbilledTime(db, business.id, {
      invoiceId,
      grouping: "person_rate",
    });
    expect(generated).toMatchObject({ ok: true, lineCount: 1 });

    // Spec S7 example: 4h05m at EUR 62.00/h = 253.17 subtotal;
    // 21% of 25317 = 5316.57 -> 5317 tax (half-up); total 306.34.
    const [inv] = await db
      .select()
      .from(schema.invoice)
      .where(eq(schema.invoice.id, invoiceId));
    expect(inv.subtotalMinor).toBe(25317);
    expect(inv.taxMinor).toBe(5317);
    expect(inv.totalMinor).toBe(30634);

    // The two billable entries are linked; the non-billable one is not.
    const linked = await db
      .select()
      .from(schema.timeEntry)
      .where(
        and(
          eq(schema.timeEntry.businessId, business.id),
          isNull(schema.timeEntry.invoiceLineId),
        ),
      );
    expect(linked).toHaveLength(1);
    expect(linked[0].billable).toBe(false);

    // A second generation finds nothing unbilled.
    const again = await generateLinesFromUnbilledTime(db, business.id, {
      invoiceId,
      grouping: "person_rate",
    });
    expect(again).toMatchObject({ ok: false, reason: "nothing_to_bill" });

    // Removing the draft line releases the entries and zeroes totals.
    const [line] = await db
      .select({ id: schema.invoiceLine.id })
      .from(schema.invoiceLine)
      .where(eq(schema.invoiceLine.invoiceId, invoiceId));
    const afterDelete = await deleteInvoiceLine(db, business.id, line.id);
    expect(afterDelete?.subtotalMinor).toBe(0);
    expect(afterDelete?.totalMinor).toBe(0);

    const released = await db
      .select()
      .from(schema.timeEntry)
      .where(
        and(
          eq(schema.timeEntry.businessId, business.id),
          isNull(schema.timeEntry.invoiceLineId),
        ),
      );
    expect(released).toHaveLength(3);
  });

  it("supports fixed-amount manual lines alongside generated ones", async () => {
    const draft = await createDraftInvoice(db, business.id, {
      clientId: client.id,
      currency: "EUR",
      taxTreatment: "standard",
      standardRatePercent: "21",
    });
    const invoiceId = (draft as { id: string }).id;

    // Exact amount in: EUR 1,500.00 -> 150000 minor, taxed on the subtotal.
    const added = await addManualLine(db, business.id, {
      invoiceId,
      description: "Discovery workshop (fixed fee)",
      amountMajor: "1500",
    });
    expect(added).toMatchObject({ ok: true });
    if (added.ok) {
      expect(added.invoice?.subtotalMinor).toBe(150000);
      expect(added.invoice?.taxMinor).toBe(31500);
      expect(added.invoice?.totalMinor).toBe(181500);
    }

    // More decimals than the currency allows is rejected, never rounded.
    const rejected = await addManualLine(db, business.id, {
      invoiceId,
      description: "Bad amount",
      amountMajor: "10.005",
    });
    expect(rejected).toMatchObject({ ok: false, reason: "bad_amount" });

    // Manual lines coexist with generated ones; totals stay one pipeline.
    const generated = await generateLinesFromUnbilledTime(db, business.id, {
      invoiceId,
      grouping: "person_rate",
    });
    if (generated.ok) {
      const [inv] = await db
        .select()
        .from(schema.invoice)
        .where(eq(schema.invoice.id, invoiceId));
      expect(inv.subtotalMinor).toBe(150000 + 25317);
    }

    // Cleanup: release entries for the later tests in this file.
    const lines = await db
      .select({ id: schema.invoiceLine.id })
      .from(schema.invoiceLine)
      .where(eq(schema.invoiceLine.invoiceId, invoiceId));
    for (const line of lines) {
      await deleteInvoiceLine(db, business.id, line.id);
    }
  });

  it("refuses to add generated lines to an issued invoice", async () => {
    const draft = await createDraftInvoice(db, business.id, {
      clientId: client.id,
      currency: "EUR",
      taxTreatment: "standard",
      standardRatePercent: "21",
    });
    const invoiceId = (draft as { id: string }).id;
    await generateLinesFromUnbilledTime(db, business.id, {
      invoiceId,
      grouping: "person_rate",
    });
    const issued = await issueInvoice(db, business.id, invoiceId);
    expect(issued?.number).toBeTruthy();

    const blocked = await generateLinesFromUnbilledTime(db, business.id, {
      invoiceId,
      grouping: "person_rate",
    });
    expect(blocked).toMatchObject({ ok: false, reason: "no_draft" });

    // And issued lines cannot be deleted.
    const [line] = await db
      .select({ id: schema.invoiceLine.id })
      .from(schema.invoiceLine)
      .where(eq(schema.invoiceLine.invoiceId, invoiceId));
    expect(await deleteInvoiceLine(db, business.id, line.id)).toBeNull();
  });
});
