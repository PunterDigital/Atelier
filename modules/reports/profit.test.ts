import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { schema, type Db } from "@/db";
import { createClient } from "@/modules/clients/service";
import { createProject } from "@/modules/projects/service";
import { createTask } from "@/modules/projects/tasks-service";
import { createTestDatabase } from "@/db/testing";

import { computeProfit, profitSummary, type ProfitInput } from "./profit";

describe("computeProfit (pure core)", () => {
  it("buckets per currency and never crosses them", () => {
    const input: ProfitInput = {
      income: [
        { currency: "EUR", amountMinor: 100_000, paid: true },
        { currency: "USD", amountMinor: 50_000, paid: true },
      ],
      expenses: [{ currency: "EUR", amountMinor: 10_000, paid: true }],
      labour: [{ currency: "USD", amountMinor: 20_000, paid: true }],
    };
    const { accrual } = computeProfit(input);
    const eur = accrual.find((b) => b.currency === "EUR");
    const usd = accrual.find((b) => b.currency === "USD");
    expect(eur).toMatchObject({ incomeMinor: 100_000, expenseMinor: 10_000, labourMinor: 0, profitMinor: 90_000 });
    expect(usd).toMatchObject({ incomeMinor: 50_000, expenseMinor: 0, labourMinor: 20_000, profitMinor: 30_000 });
  });

  it("allows negative profit", () => {
    const { accrual } = computeProfit({
      income: [{ currency: "EUR", amountMinor: 10_000, paid: true }],
      expenses: [{ currency: "EUR", amountMinor: 8_000, paid: true }],
      labour: [{ currency: "EUR", amountMinor: 9_000, paid: true }],
    });
    expect(accrual[0].profitMinor).toBe(-7_000);
  });

  it("counts unpaid items in accrual but not cash", () => {
    const input: ProfitInput = {
      income: [
        { currency: "EUR", amountMinor: 100_000, paid: true },
        { currency: "EUR", amountMinor: 40_000, paid: false }, // issued, unpaid
      ],
      expenses: [{ currency: "EUR", amountMinor: 5_000, paid: false }],
      labour: [{ currency: "EUR", amountMinor: 3_000, paid: false }],
    };
    const { cash, accrual } = computeProfit(input);
    // Cash: only the paid invoice, no unpaid expense/labour.
    expect(cash[0]).toMatchObject({ incomeMinor: 100_000, expenseMinor: 0, labourMinor: 0, profitMinor: 100_000 });
    // Accrual: everything recognised.
    expect(accrual[0]).toMatchObject({ incomeMinor: 140_000, expenseMinor: 5_000, labourMinor: 3_000, profitMinor: 132_000 });
  });

  it("treats absent labour as zero", () => {
    const { accrual } = computeProfit({
      income: [{ currency: "EUR", amountMinor: 10_000, paid: true }],
      expenses: [],
      labour: [],
    });
    expect(accrual[0].labourMinor).toBe(0);
    expect(accrual[0].profitMinor).toBe(10_000);
  });
});

let pglite: PGlite;
let db: Db;
let businessA: { id: string };
let businessB: { id: string };
const userA = "profit-user-a";

// Inserts an issued invoice with one line and a billed, costed time entry, so
// profitSummary has income + labour to fold. Returns nothing - the assertions
// read back through profitSummary.
async function seedBilledWork(opts: {
  businessId: string;
  clientId: string;
  taskId: string;
  status: "sent" | "paid";
  invoiceTotalMinor: number;
  internalCostHourly: number;
  durationSeconds: number;
}) {
  const [invoice] = await db
    .insert(schema.invoice)
    .values({
      businessId: opts.businessId,
      clientId: opts.clientId,
      status: opts.status,
      currency: "EUR",
      issueDate: new Date("2026-05-01T00:00:00Z"),
      taxTreatment: "zero_rated",
      totalMinor: opts.invoiceTotalMinor,
      subtotalMinor: opts.invoiceTotalMinor,
    })
    .returning();
  const [line] = await db
    .insert(schema.invoiceLine)
    .values({
      businessId: opts.businessId,
      invoiceId: invoice.id,
      position: 1,
      description: "Work",
      totalMinor: opts.invoiceTotalMinor,
    })
    .returning();
  await db.insert(schema.timeEntry).values({
    businessId: opts.businessId,
    taskId: opts.taskId,
    userId: userA,
    startedAt: new Date("2026-04-20T09:00:00Z"),
    endedAt: new Date("2026-04-20T17:00:00Z"),
    durationSeconds: opts.durationSeconds,
    billable: true,
    rateMinor: 4000,
    rateCurrency: "EUR",
    internalCostMinor: opts.internalCostHourly,
    internalCostCurrency: "EUR",
    invoiceLineId: line.id,
  });
}

describe("profitSummary (db)", () => {
  let clientA: { id: string };
  let taskA: { id: string };

  beforeAll(async () => {
    ({ pglite, db } = await createTestDatabase());

    [businessA] = await db
      .insert(schema.business)
      .values({ name: "Profit Co", currency: "EUR" })
      .returning();
    [businessB] = await db
      .insert(schema.business)
      .values({ name: "Other Co", currency: "EUR" })
      .returning();
    await db
      .insert(schema.user)
      .values({ id: userA, name: "Pia", email: "pia@profit.test" });

    clientA = await createClient(db, businessA.id, userA, {
      name: "Profit client",
      contacts: [],
    });
    const project = (await createProject(db, businessA.id, userA, {
      name: "Profit project",
      clientId: clientA.id,
      status: "active",
    })) as { id: string };
    taskA = (await createTask(db, businessA.id, project.id, {
      title: "Profit task",
      status: "todo",
    })) as { id: string };

    // One paid invoice (EUR 800) with 8h at EUR 27.50/h cost = EUR 220 labour.
    await seedBilledWork({
      businessId: businessA.id,
      clientId: clientA.id,
      taskId: taskA.id,
      status: "paid",
      invoiceTotalMinor: 80_000,
      internalCostHourly: 2750,
      durationSeconds: 8 * 3600,
    });
    // One sent (unpaid) invoice (EUR 400) with 4h at EUR 27.50/h = EUR 110.
    await seedBilledWork({
      businessId: businessA.id,
      clientId: clientA.id,
      taskId: taskA.id,
      status: "sent",
      invoiceTotalMinor: 40_000,
      internalCostHourly: 2750,
      durationSeconds: 4 * 3600,
    });

    // A paid and an unpaid expense.
    await db.insert(schema.expense).values([
      {
        businessId: businessA.id,
        description: "Paid expense",
        amountMinor: 5_000,
        currency: "EUR",
        status: "paid",
        incurredAt: new Date("2026-04-15T00:00:00Z"),
        paidAt: new Date("2026-04-16T00:00:00Z"),
      },
      {
        businessId: businessA.id,
        description: "Unpaid expense",
        amountMinor: 3_000,
        currency: "EUR",
        status: "unpaid",
        incurredAt: new Date("2026-04-18T00:00:00Z"),
      },
    ]);
  });

  afterAll(async () => {
    await pglite.close();
  });

  it("computes cash from paid items only", async () => {
    const { cash } = await profitSummary(db, businessA.id);
    expect(cash).toHaveLength(1);
    // Income 800, expense 5, labour 220 -> profit 575.
    expect(cash[0]).toMatchObject({
      currency: "EUR",
      incomeMinor: 80_000,
      expenseMinor: 5_000,
      labourMinor: 22_000,
      profitMinor: 53_000,
    });
  });

  it("computes accrual from all issued/recorded items", async () => {
    const { accrual } = await profitSummary(db, businessA.id);
    // Income 800+400=1200, expense 5+3=8, labour 220+110=330 -> profit 862.
    expect(accrual[0]).toMatchObject({
      currency: "EUR",
      incomeMinor: 120_000,
      expenseMinor: 8_000,
      labourMinor: 33_000,
      profitMinor: 79_000,
    });
  });

  it("is scoped to the business", async () => {
    const { cash, accrual } = await profitSummary(db, businessB.id);
    expect(cash).toHaveLength(0);
    expect(accrual).toHaveLength(0);
  });
});
