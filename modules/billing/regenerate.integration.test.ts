import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { and, eq, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { schema, type Db } from "@/db";
import { createClient } from "@/modules/clients/service";
import { createProject } from "@/modules/projects/service";
import { createTask } from "@/modules/projects/tasks-service";
import { logManualEntry } from "@/modules/time/service";

import { addManualLine, generateLinesFromUnbilledTime } from "./generate";
import { createDraftInvoice } from "./invoices";

const migrationsFolder = fileURLToPath(
  new URL("../../db/migrations", import.meta.url),
);

let pglite: PGlite;
let db: Db;
let business: { id: string };
let client: { id: string };
let project: { id: string };
let taskOne: { id: string };
let taskTwo: { id: string };
let draftA: { id: string };
let draftB: { id: string };
const user = "user-a";

beforeAll(async () => {
  pglite = new PGlite();
  const pgliteDb = drizzle(pglite, { schema });
  await migrate(pgliteDb, { migrationsFolder });
  db = pgliteDb;

  [business] = await db
    .insert(schema.business)
    .values({ name: "Alpha Studio", currency: "EUR" })
    .returning();
  await db
    .insert(schema.user)
    .values([{ id: user, name: "Shay", email: "shay@alpha.test" }]);
  client = await createClient(db, business.id, user, {
    name: "Northwind",
    contacts: [],
    defaultRateMinor: 6000,
    defaultRateCurrency: "EUR",
  });
  project = (await createProject(db, business.id, user, {
    name: "Website",
    clientId: client.id,
    status: "active",
  })) as { id: string };
  taskOne = (await createTask(db, business.id, project.id, {
    title: "Build",
    status: "in_progress",
  })) as { id: string };
  taskTwo = (await createTask(db, business.id, project.id, {
    title: "Review",
    status: "in_progress",
  })) as { id: string };

  await logManualEntry(db, business.id, user, {
    taskId: taskOne.id,
    startedAt: new Date("2026-06-08T09:00:00Z"),
    durationSeconds: 7200,
    billable: true,
  });
  await logManualEntry(db, business.id, user, {
    taskId: taskTwo.id,
    startedAt: new Date("2026-06-09T09:00:00Z"),
    durationSeconds: 3600,
    billable: true,
  });
});

afterAll(async () => {
  await pglite.close();
});

describe("nothing_to_bill diagnostics and replace-regeneration (integration)", () => {
  it("explains a nothing_to_bill result: which invoice holds the billed time", async () => {
    draftA = (await createDraftInvoice(db, business.id, {
      clientId: client.id,
      currency: "EUR",
      taxTreatment: "zero_rated",
    })) as { id: string };
    const first = await generateLinesFromUnbilledTime(db, business.id, {
      invoiceId: draftA.id,
      grouping: "person_rate",
    });
    expect(first).toMatchObject({ ok: true, lineCount: 1 });

    // A second draft finds nothing - and says exactly why, so "no lines"
    // is actionable instead of a mystery (the Tom scenario).
    draftB = (await createDraftInvoice(db, business.id, {
      clientId: client.id,
      currency: "EUR",
      taxTreatment: "zero_rated",
    })) as { id: string };
    const second = await generateLinesFromUnbilledTime(db, business.id, {
      invoiceId: draftB.id,
      grouping: "person_rate",
    });
    expect(second).toEqual({
      ok: false,
      reason: "nothing_to_bill",
      details: {
        unpriced: 0,
        running: 0,
        nonBillable: 0,
        alreadyBilled: [
          { invoiceId: draftA.id, number: null, status: "draft", entries: 2 },
        ],
      },
    });
  });

  it("counts unpriced, running and non-billable entries in the details", async () => {
    await db.insert(schema.timeEntry).values([
      {
        // Billable and closed but stored without a rate - unpriceable.
        businessId: business.id,
        taskId: taskOne.id,
        userId: user,
        startedAt: new Date("2026-06-10T09:00:00Z"),
        endedAt: new Date("2026-06-10T10:00:00Z"),
        durationSeconds: 3600,
        billable: true,
      },
      {
        // Timer never stopped.
        businessId: business.id,
        taskId: taskOne.id,
        userId: user,
        startedAt: new Date("2026-06-10T11:00:00Z"),
        billable: true,
        rateMinor: 6000,
        rateCurrency: "EUR",
      },
      {
        businessId: business.id,
        taskId: taskTwo.id,
        userId: user,
        startedAt: new Date("2026-06-10T12:00:00Z"),
        endedAt: new Date("2026-06-10T13:00:00Z"),
        durationSeconds: 3600,
        billable: false,
        rateMinor: 6000,
        rateCurrency: "EUR",
      },
    ]);

    const result = await generateLinesFromUnbilledTime(db, business.id, {
      invoiceId: draftB.id,
      grouping: "person_rate",
    });
    expect(result).toMatchObject({
      ok: false,
      reason: "nothing_to_bill",
      details: {
        unpriced: 1,
        running: 1,
        nonBillable: 1,
        alreadyBilled: [
          { invoiceId: draftA.id, number: null, status: "draft", entries: 2 },
        ],
      },
    });
  });

  it("replace clears the generated lines and regenerates with the new grouping, keeping manual lines", async () => {
    const manual = await addManualLine(db, business.id, {
      invoiceId: draftA.id,
      description: "Setup fee",
      amountMajor: "100",
    });
    expect(manual.ok).toBe(true);

    const regenerated = await generateLinesFromUnbilledTime(db, business.id, {
      invoiceId: draftA.id,
      grouping: "task",
      replace: true,
    });
    // Two per-task lines; the stray unpriced entry joins the pool and is
    // reported, never silently dropped.
    expect(regenerated).toMatchObject({ ok: true, lineCount: 2 });
    expect(
      (regenerated as { unpricedEntryIds: string[] }).unpricedEntryIds,
    ).toHaveLength(1);

    const lines = await db
      .select()
      .from(schema.invoiceLine)
      .where(eq(schema.invoiceLine.invoiceId, draftA.id))
      .orderBy(schema.invoiceLine.position);
    expect(lines).toHaveLength(3);
    expect(lines.map((l) => l.description).sort()).toEqual([
      "Build",
      "Review",
      "Setup fee",
    ]);

    // 2h + 1h at EUR 60/h = 180.00 plus the 100.00 manual line.
    const [inv] = await db
      .select()
      .from(schema.invoice)
      .where(eq(schema.invoice.id, draftA.id));
    expect(inv.subtotalMinor).toBe(28000);

    // Both priced entries are linked to the fresh per-task lines.
    const linked = await db
      .select({ lineId: schema.timeEntry.invoiceLineId })
      .from(schema.timeEntry)
      .where(
        and(
          eq(schema.timeEntry.businessId, business.id),
          isNotNull(schema.timeEntry.invoiceLineId),
        ),
      );
    const taskLineIds = lines
      .filter((l) => l.quantity !== null)
      .map((l) => l.id);
    expect(linked).toHaveLength(2);
    for (const row of linked) {
      expect(taskLineIds).toContain(row.lineId);
    }
  });

  it("a failed grouping in replace mode leaves the existing lines untouched", async () => {
    // A second rate in the pool makes "single" refuse - the validation runs
    // before anything is deleted, so the draft keeps its lines and links.
    await logManualEntry(db, business.id, user, {
      taskId: taskTwo.id,
      startedAt: new Date("2026-06-11T09:00:00Z"),
      durationSeconds: 1800,
      billable: true,
      rateMinor: 7000,
      rateCurrency: "EUR",
    });

    const blocked = await generateLinesFromUnbilledTime(db, business.id, {
      invoiceId: draftA.id,
      grouping: "single",
      replace: true,
    });
    expect(blocked).toMatchObject({
      ok: false,
      reason: "mixed_rates_for_single_line",
    });

    const lines = await db
      .select()
      .from(schema.invoiceLine)
      .where(eq(schema.invoiceLine.invoiceId, draftA.id));
    expect(lines).toHaveLength(3);
    const linked = await db
      .select({ id: schema.timeEntry.id })
      .from(schema.timeEntry)
      .where(
        and(
          eq(schema.timeEntry.businessId, business.id),
          isNotNull(schema.timeEntry.invoiceLineId),
        ),
      );
    expect(linked).toHaveLength(2);
  });
});
