import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { schema, type Db } from "@/db";
import { createClient } from "@/modules/clients/service";
import { createProject } from "@/modules/projects/service";
import { createTask } from "@/modules/projects/tasks-service";

import {
  clientBudgetStatus,
  memberBudgetStatuses,
} from "./budgets";

const migrationsFolder = fileURLToPath(
  new URL("../../db/migrations", import.meta.url),
);

let pglite: PGlite;
let db: Db;
let business: { id: string };
const userA = "budget-user-a";

// A billable, closed entry priced at rateMinor/h for the given hours.
async function logEntry(
  businessId: string,
  taskId: string,
  hours: number,
  rateMinor: number,
  rateCurrency: string,
) {
  await db.insert(schema.timeEntry).values({
    businessId,
    taskId,
    userId: userA,
    startedAt: new Date("2026-04-20T09:00:00Z"),
    endedAt: new Date("2026-04-20T17:00:00Z"),
    durationSeconds: hours * 3600,
    billable: true,
    rateMinor,
    rateCurrency,
  });
}

beforeAll(async () => {
  pglite = new PGlite();
  const pgliteDb = drizzle(pglite, { schema });
  await migrate(pgliteDb, { migrationsFolder });
  db = pgliteDb;

  [business] = await db
    .insert(schema.business)
    .values({ name: "Budget Co", currency: "EUR" })
    .returning();
  await db
    .insert(schema.user)
    .values({ id: userA, name: "Bo", email: "bo@budget.test" });
});

afterAll(async () => {
  await pglite.close();
});

async function freshClient(budgetMinor: number | null) {
  const client = await createClient(db, business.id, userA, {
    name: "Budget client",
    contacts: [],
  });
  if (budgetMinor != null) {
    await db
      .update(schema.client)
      .set({ budgetMinor, budgetCurrency: "EUR" })
      .where(eq(schema.client.id, client.id));
  }
  const project = (await createProject(db, business.id, userA, {
    name: "P",
    clientId: client.id,
    status: "active",
  })) as { id: string };
  const task = (await createTask(db, business.id, project.id, {
    title: "T",
    status: "todo",
  })) as { id: string };
  return { client, task };
}

describe("clientBudgetStatus", () => {
  it("returns null when no budget is set", async () => {
    const { client } = await freshClient(null);
    expect(await clientBudgetStatus(db, business.id, client.id)).toBeNull();
  });

  it("is ok well under budget", async () => {
    const { client, task } = await freshClient(100_000); // EUR 1000
    await logEntry(business.id, task.id, 10, 5000, "EUR"); // EUR 500
    const status = await clientBudgetStatus(db, business.id, client.id);
    expect(status?.state).toBe("ok");
    expect(status?.spentMinor).toBe(50_000);
  });

  it("is near at 80%+ and over at 100%+", async () => {
    const near = await freshClient(100_000);
    await logEntry(business.id, near.task.id, 16, 5000, "EUR"); // EUR 800 = 80%
    expect((await clientBudgetStatus(db, business.id, near.client.id))?.state).toBe(
      "near",
    );

    const over = await freshClient(100_000);
    await logEntry(business.id, over.task.id, 24, 5000, "EUR"); // EUR 1200 = 120%
    expect((await clientBudgetStatus(db, business.id, over.client.id))?.state).toBe(
      "over",
    );
  });

  it("flags work logged in another currency", async () => {
    const { client, task } = await freshClient(100_000);
    await logEntry(business.id, task.id, 4, 5000, "EUR");
    await logEntry(business.id, task.id, 4, 6000, "GBP");
    const status = await clientBudgetStatus(db, business.id, client.id);
    // Only the EUR slice counts toward the EUR budget.
    expect(status?.spentMinor).toBe(20_000);
    expect(status?.currencyMismatch).toContain("GBP");
  });
});

describe("memberBudgetStatuses", () => {
  it("reports per-member budgets keyed by user id", async () => {
    const { client, task } = await freshClient(null);
    await db.insert(schema.clientMemberRate).values({
      businessId: business.id,
      clientId: client.id,
      userId: userA,
      billRateMinor: 5000,
      billRateCurrency: "EUR",
      budgetMinor: 50_000, // EUR 500
      budgetCurrency: "EUR",
    });
    await logEntry(business.id, task.id, 9, 5000, "EUR"); // EUR 450 = 90%
    const statuses = await memberBudgetStatuses(db, business.id, client.id);
    expect(statuses[userA]?.state).toBe("near");
    expect(statuses[userA]?.spentMinor).toBe(45_000);
  });
});
