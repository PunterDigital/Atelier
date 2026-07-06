import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { schema, type Db } from "@/db";
import { createClient } from "@/modules/clients/service";

import {
  createSchedule,
  deleteSchedule,
  generateNow,
  getSchedule,
  listGeneratedInvoices,
  listSchedules,
  runDueSchedules,
  setScheduleStatus,
  updateSchedule,
  type ScheduleInput,
} from "./recurring";

const migrationsFolder = fileURLToPath(
  new URL("../../db/migrations", import.meta.url),
);

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

let pglite: PGlite;
let db: Db;
let businessA: { id: string };
let businessB: { id: string };
let clientA: { id: string };
let clientB: { id: string };
const userA = "user-a";

function scheduleInput(
  clientId: string,
  overrides: Partial<ScheduleInput> = {},
): ScheduleInput {
  return {
    clientId,
    name: "Monthly retainer",
    currency: "EUR",
    taxTreatment: "zero_rated",
    frequency: "monthly",
    interval: 1,
    startDate: utc("2026-01-15"),
    netTermsDays: 14,
    autoIssue: false,
    lines: [{ description: "Retainer", amountMinor: 120000 }],
    ...overrides,
  };
}

async function invoicesFor(scheduleId: string, businessId: string) {
  return listGeneratedInvoices(db, businessId, scheduleId);
}

beforeAll(async () => {
  pglite = new PGlite();
  const pgliteDb = drizzle(pglite, { schema });
  await migrate(pgliteDb, { migrationsFolder });
  db = pgliteDb;

  [businessA] = await db
    .insert(schema.business)
    .values({ name: "Alpha Studio", currency: "EUR" })
    .returning();
  [businessB] = await db
    .insert(schema.business)
    .values({ name: "Beta Works", currency: "EUR" })
    .returning();
  await db
    .insert(schema.user)
    .values([{ id: userA, name: "Ada", email: "ada@alpha.test" }]);
  clientA = await createClient(db, businessA.id, userA, {
    name: "Alpha client",
    contacts: [],
  });
  clientB = await createClient(db, businessB.id, userA, {
    name: "Beta client",
    contacts: [],
  });
});

afterAll(async () => {
  await pglite.close();
});

describe("createSchedule", () => {
  it("stores the template and anchors the next run to the start date", async () => {
    const created = await createSchedule(db, businessA.id, scheduleInput(clientA.id));
    expect(created).not.toBeNull();
    expect(created?.nextRunAt).toEqual(utc("2026-01-15"));
    expect(created?.anchorDay).toBe(15);
    expect(created?.status).toBe("active");

    const full = await getSchedule(db, businessA.id, created!.id);
    expect(full?.lines).toHaveLength(1);
    expect(full?.lines[0].amountMinor).toBe(120000);
  });

  it("refuses a client from another business", async () => {
    expect(
      await createSchedule(db, businessA.id, scheduleInput(clientB.id)),
    ).toBeNull();
  });
});

describe("generateNow", () => {
  it("creates one draft dated at the occurrence, due after net terms", async () => {
    const s = await createSchedule(db, businessA.id, scheduleInput(clientA.id));
    const result = await generateNow(db, businessA.id, s!.id, utc("2026-01-20"));
    expect(result).toEqual({ generated: 1, issued: false, error: null });

    const invoices = await invoicesFor(s!.id, businessA.id);
    expect(invoices).toHaveLength(1);
    expect(invoices[0].status).toBe("draft");
    expect(invoices[0].totalMinor).toBe(120000);
    expect(invoices[0].issueDate).toEqual(utc("2026-01-15"));
    // 14 net days after the 15th.
    expect(invoices[0].dueDate).toEqual(utc("2026-01-29"));

    // The schedule advanced to the following month.
    const after = await getSchedule(db, businessA.id, s!.id);
    expect(after?.nextRunAt).toEqual(utc("2026-02-15"));
    expect(after?.generatedCount).toBe(1);

    // The generated invoice carries the fixed line.
    const [inv] = invoices;
    const lines = await db
      .select()
      .from(schema.invoiceLine)
      .where(eq(schema.invoiceLine.invoiceId, inv.id));
    expect(lines).toHaveLength(1);
    expect(lines[0].description).toBe("Retainer");
    expect(lines[0].totalMinor).toBe(120000);
  });

  it("won't generate for another business", async () => {
    const s = await createSchedule(db, businessA.id, scheduleInput(clientA.id));
    expect(await generateNow(db, businessB.id, s!.id, utc("2026-01-20"))).toBeNull();
  });
});

describe("runDueSchedules", () => {
  it("bills nothing before the first occurrence", async () => {
    const s = await createSchedule(
      db,
      businessA.id,
      scheduleInput(clientA.id, { startDate: utc("2026-06-01") }),
    );
    await runDueSchedules(db, utc("2026-05-01"));
    expect(await invoicesFor(s!.id, businessA.id)).toHaveLength(0);
    const after = await getSchedule(db, businessA.id, s!.id);
    expect(after?.nextRunAt).toEqual(utc("2026-06-01"));
  });

  it("catches up every occurrence owed up to now, then stops ahead of it", async () => {
    const s = await createSchedule(
      db,
      businessA.id,
      scheduleInput(clientA.id, { startDate: utc("2026-01-15") }),
    );
    // Jan 15, Feb 15, Mar 15 are all due by Mar 20; Apr 15 is not.
    await runDueSchedules(db, utc("2026-03-20"));
    expect(await invoicesFor(s!.id, businessA.id)).toHaveLength(3);
    const after = await getSchedule(db, businessA.id, s!.id);
    expect(after?.nextRunAt).toEqual(utc("2026-04-15"));
    expect(after?.generatedCount).toBe(3);

    // A second sweep at the same instant is a no-op (idempotent).
    await runDueSchedules(db, utc("2026-03-20"));
    expect(await invoicesFor(s!.id, businessA.id)).toHaveLength(3);
  });

  it("stops at an occurrence limit and ends the schedule", async () => {
    const s = await createSchedule(
      db,
      businessA.id,
      scheduleInput(clientA.id, {
        startDate: utc("2026-01-15"),
        occurrenceLimit: 2,
      }),
    );
    await runDueSchedules(db, utc("2026-06-20"));
    expect(await invoicesFor(s!.id, businessA.id)).toHaveLength(2);
    const after = await getSchedule(db, businessA.id, s!.id);
    expect(after?.status).toBe("ended");
  });

  it("stops once the next occurrence passes the end date", async () => {
    const s = await createSchedule(
      db,
      businessA.id,
      scheduleInput(clientA.id, {
        startDate: utc("2026-01-15"),
        endDate: utc("2026-02-20"),
      }),
    );
    await runDueSchedules(db, utc("2026-06-20"));
    // Jan 15 and Feb 15 fall on/before the end date; Mar 15 would not.
    expect(await invoicesFor(s!.id, businessA.id)).toHaveLength(2);
    expect((await getSchedule(db, businessA.id, s!.id))?.status).toBe("ended");
  });

  it("auto-issues generated drafts when the schedule says so", async () => {
    const s = await createSchedule(
      db,
      businessA.id,
      scheduleInput(clientA.id, {
        startDate: utc("2026-01-15"),
        occurrenceLimit: 1,
        autoIssue: true,
      }),
    );
    await runDueSchedules(db, utc("2026-01-20"));
    const invoices = await invoicesFor(s!.id, businessA.id);
    expect(invoices).toHaveLength(1);
    expect(invoices[0].status).toBe("sent");
    expect(invoices[0].number).toBeTruthy();
  });

  it("leaves an un-issuable draft and flags the schedule (fail loud)", async () => {
    // Reverse charge can't issue without both VAT numbers - the invoice stays
    // a draft and the schedule records why.
    const s = await createSchedule(
      db,
      businessA.id,
      scheduleInput(clientA.id, {
        startDate: utc("2026-01-15"),
        occurrenceLimit: 1,
        autoIssue: true,
        taxTreatment: "reverse_charge",
      }),
    );
    await runDueSchedules(db, utc("2026-01-20"));
    const invoices = await invoicesFor(s!.id, businessA.id);
    expect(invoices).toHaveLength(1);
    expect(invoices[0].status).toBe("draft");
    const after = await getSchedule(db, businessA.id, s!.id);
    expect(after?.lastError).toBeTruthy();
  });
});

describe("pause and resume", () => {
  it("resuming skips the occurrences missed while paused", async () => {
    const s = await createSchedule(
      db,
      businessA.id,
      scheduleInput(clientA.id, { startDate: utc("2026-01-15") }),
    );
    await setScheduleStatus(db, businessA.id, s!.id, "paused");
    // Resume in March: Jan/Feb/Mar occurrences are skipped, not back-billed.
    const resumed = await setScheduleStatus(
      db,
      businessA.id,
      s!.id,
      "active",
      utc("2026-03-20"),
    );
    expect(resumed?.status).toBe("active");
    expect(resumed?.nextRunAt).toEqual(utc("2026-04-15"));

    await runDueSchedules(db, utc("2026-03-25"));
    expect(await invoicesFor(s!.id, businessA.id)).toHaveLength(0);
  });

  it("won't reactivate an ended schedule", async () => {
    const s = await createSchedule(
      db,
      businessA.id,
      scheduleInput(clientA.id, { occurrenceLimit: 1 }),
    );
    await runDueSchedules(db, utc("2026-06-20"));
    expect((await getSchedule(db, businessA.id, s!.id))?.status).toBe("ended");
    expect(
      await setScheduleStatus(db, businessA.id, s!.id, "active", utc("2026-07-01")),
    ).toBeNull();
  });
});

describe("updateSchedule", () => {
  it("replaces lines and re-pins next run when nothing has generated yet", async () => {
    const s = await createSchedule(db, businessA.id, scheduleInput(clientA.id));
    const updated = await updateSchedule(
      db,
      businessA.id,
      s!.id,
      scheduleInput(clientA.id, {
        name: "Bigger retainer",
        startDate: utc("2026-02-01"),
        lines: [
          { description: "Retainer", amountMinor: 150000 },
          { description: "Hosting", amountMinor: 5000 },
        ],
      }),
    );
    expect(updated?.name).toBe("Bigger retainer");
    expect(updated?.nextRunAt).toEqual(utc("2026-02-01"));
    const full = await getSchedule(db, businessA.id, s!.id);
    expect(full?.lines).toHaveLength(2);
  });
});

describe("deleteSchedule", () => {
  it("removes the schedule but keeps the invoices it produced", async () => {
    const s = await createSchedule(db, businessA.id, scheduleInput(clientA.id));
    await generateNow(db, businessA.id, s!.id, utc("2026-01-20"));
    const [invoice] = await invoicesFor(s!.id, businessA.id);

    expect(await deleteSchedule(db, businessA.id, s!.id)).toEqual({ id: s!.id });
    expect(await getSchedule(db, businessA.id, s!.id)).toBeNull();

    // The invoice survives, detached from the deleted schedule.
    const [survivor] = await db
      .select()
      .from(schema.invoice)
      .where(
        and(
          eq(schema.invoice.businessId, businessA.id),
          eq(schema.invoice.id, invoice.id),
        ),
      );
    expect(survivor).toBeDefined();
    expect(survivor.scheduleId).toBeNull();
  });
});

describe("listSchedules", () => {
  it("scopes to the business and sums the template total", async () => {
    const listA = await listSchedules(db, businessA.id);
    expect(listA.length).toBeGreaterThan(0);
    for (const row of listA) {
      expect(row.clientName).toBe("Alpha client");
      expect(row.subtotalMinor).toBeGreaterThan(0);
    }
    // Business B never created a schedule.
    expect(await listSchedules(db, businessB.id)).toHaveLength(0);
  });
});
