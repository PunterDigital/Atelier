import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { schema, type Db } from "@/db";
import { createClient } from "@/modules/clients/service";
import { createProject } from "@/modules/projects/service";
import { createTask } from "@/modules/projects/tasks-service";
import { createTestDatabase } from "@/db/testing";

import {
  deleteEntry,
  getRunningTimer,
  listEntriesBetween,
  listEntriesForTask,
  logManualEntry,
  startTimer,
  stopTimer,
} from "./service";

let pglite: PGlite;
let db: Db;

let businessA: { id: string };
let businessB: { id: string };
let taskNoRates: { id: string };
let taskProjectRate: { id: string };
let taskClientRate: { id: string };
let taskB: { id: string };
const userA = "user-a";
const userB = "user-b";

beforeAll(async () => {
  ({ pglite, db } = await createTestDatabase());

  [businessA] = await db
    .insert(schema.business)
    .values({ name: "Alpha Studio", currency: "GBP" })
    .returning();
  [businessB] = await db
    .insert(schema.business)
    .values({ name: "Beta Works", currency: "CZK" })
    .returning();
  await db.insert(schema.user).values([
    { id: userA, name: "Ada", email: "ada@alpha.test" },
    { id: userB, name: "Ben", email: "ben@beta.test" },
  ]);

  // Client with a default rate of GBP 50.00/h
  const clientA = await createClient(db, businessA.id, userA, {
    name: "Alpha client",
    contacts: [],
  });
  await db
    .update(schema.client)
    .set({ defaultRateMinor: 5000, defaultRateCurrency: "GBP" })
    .where(eq(schema.client.id, clientA.id));

  // Project without a rate (falls through to client) and one with EUR 62.00/h
  const plainProject = (await createProject(db, businessA.id, userA, {
    name: "Plain project",
    clientId: clientA.id,
    status: "active",
  })) as { id: string };
  const ratedProject = (await createProject(db, businessA.id, userA, {
    name: "Rated project",
    clientId: clientA.id,
    status: "active",
  })) as { id: string };
  await db
    .update(schema.project)
    .set({ defaultRateMinor: 6200, defaultRateCurrency: "EUR" })
    .where(eq(schema.project.id, ratedProject.id));

  // A client/project pair with no rates anywhere
  const bareClient = await createClient(db, businessA.id, userA, {
    name: "Bare client",
    contacts: [],
  });
  const bareProject = (await createProject(db, businessA.id, userA, {
    name: "Bare project",
    clientId: bareClient.id,
    status: "active",
  })) as { id: string };

  taskClientRate = (await createTask(db, businessA.id, plainProject.id, {
    title: "Client-rate task",
    status: "todo",
  })) as { id: string };
  taskProjectRate = (await createTask(db, businessA.id, ratedProject.id, {
    title: "Project-rate task",
    status: "todo",
  })) as { id: string };
  taskNoRates = (await createTask(db, businessA.id, bareProject.id, {
    title: "No-rate task",
    status: "todo",
  })) as { id: string };

  const clientB = await createClient(db, businessB.id, userB, {
    name: "Beta client",
    contacts: [],
  });
  const projectB = (await createProject(db, businessB.id, userB, {
    name: "Beta project",
    clientId: clientB.id,
    status: "active",
  })) as { id: string };
  taskB = (await createTask(db, businessB.id, projectB.id, {
    title: "Beta task",
    status: "todo",
  })) as { id: string };
});

afterAll(async () => {
  await pglite.close();
});

describe("time service - cross-business isolation", () => {
  it("refuses timers and manual entries on another business's task", async () => {
    expect(await startTimer(db, businessA.id, userA, taskB.id)).toBeNull();
    expect(
      await logManualEntry(db, businessA.id, userA, {
        taskId: taskB.id,
        startedAt: new Date("2026-06-08T09:00:00Z"),
        durationSeconds: 3600,
        billable: true,
      }),
    ).toBeNull();
    expect(await listEntriesForTask(db, businessA.id, taskB.id)).toEqual([]);
  });

  it("cannot delete another business's entry", async () => {
    const entry = await logManualEntry(db, businessB.id, userB, {
      taskId: taskB.id,
      startedAt: new Date("2026-06-08T09:00:00Z"),
      durationSeconds: 1800,
      billable: true,
    });
    const entryId = (entry as { id: string }).id;
    expect(await deleteEntry(db, businessA.id, entryId)).toBeNull();
    expect(await deleteEntry(db, businessB.id, entryId)).not.toBeNull();
  });
});

describe("time service - rate resolution (billing spec Section 7)", () => {
  it("uses the manual rate when given", async () => {
    const entry = await logManualEntry(db, businessA.id, userA, {
      taskId: taskClientRate.id,
      startedAt: new Date("2026-06-08T10:00:00Z"),
      durationSeconds: 3600,
      billable: true,
      rateMinor: 31000,
      rateCurrency: "EUR",
    });
    expect(entry?.rateMinor).toBe(31000);
    expect(entry?.rateCurrency).toBe("EUR");
  });

  it("falls back to the project default before the client default", async () => {
    const entry = await logManualEntry(db, businessA.id, userA, {
      taskId: taskProjectRate.id,
      startedAt: new Date("2026-06-08T11:00:00Z"),
      durationSeconds: 3600,
      billable: true,
    });
    expect(entry?.rateMinor).toBe(6200);
    expect(entry?.rateCurrency).toBe("EUR");
  });

  it("falls back to the client default when the project has none", async () => {
    const entry = await logManualEntry(db, businessA.id, userA, {
      taskId: taskClientRate.id,
      startedAt: new Date("2026-06-08T12:00:00Z"),
      durationSeconds: 3600,
      billable: true,
    });
    expect(entry?.rateMinor).toBe(5000);
    expect(entry?.rateCurrency).toBe("GBP");
  });

  it("stores no rate when nothing resolves", async () => {
    const entry = await logManualEntry(db, businessA.id, userA, {
      taskId: taskNoRates.id,
      startedAt: new Date("2026-06-08T13:00:00Z"),
      durationSeconds: 3600,
      billable: true,
    });
    expect(entry?.rateMinor).toBeNull();
    expect(entry?.rateCurrency).toBeNull();
  });
});

describe("time service - day rates and member rates", () => {
  // A client billed per day; with the default 8h day, EUR 240/day -> EUR 30/h.
  let dayClientTask: { id: string };
  // userA has a per-client member rate here: bill EUR 320/day, cost EUR 280/day.
  let memberClientTask: { id: string };

  beforeAll(async () => {
    const dayClient = await createClient(db, businessA.id, userA, {
      name: "Day-rate client",
      contacts: [],
    });
    await db
      .update(schema.client)
      .set({
        defaultRateMinor: 24000,
        defaultRateCurrency: "EUR",
        defaultRateUnit: "day",
      })
      .where(eq(schema.client.id, dayClient.id));
    const dayProject = (await createProject(db, businessA.id, userA, {
      name: "Day project",
      clientId: dayClient.id,
      status: "active",
    })) as { id: string };
    dayClientTask = (await createTask(db, businessA.id, dayProject.id, {
      title: "Day task",
      status: "todo",
    })) as { id: string };

    const memberClient = await createClient(db, businessA.id, userA, {
      name: "Member-rate client",
      contacts: [],
    });
    // A client default that the member rate should override.
    await db
      .update(schema.client)
      .set({ defaultRateMinor: 5000, defaultRateCurrency: "GBP" })
      .where(eq(schema.client.id, memberClient.id));
    await db.insert(schema.clientMemberRate).values({
      businessId: businessA.id,
      clientId: memberClient.id,
      userId: userA,
      billRateMinor: 32000,
      billRateCurrency: "EUR",
      billRateUnit: "day",
      internalCostMinor: 28000,
      internalCostCurrency: "EUR",
      internalCostUnit: "day",
    });
    const memberProject = (await createProject(db, businessA.id, userA, {
      name: "Member project",
      clientId: memberClient.id,
      status: "active",
    })) as { id: string };
    memberClientTask = (await createTask(db, businessA.id, memberProject.id, {
      title: "Member task",
      status: "todo",
    })) as { id: string };
  });

  it("converts a client day rate to an effective hourly rate", async () => {
    const entry = await logManualEntry(db, businessA.id, userA, {
      taskId: dayClientTask.id,
      startedAt: new Date("2026-06-10T09:00:00Z"),
      durationSeconds: 3600,
      billable: true,
    });
    // EUR 240.00/day over the default 8h day -> EUR 30.00/h.
    expect(entry?.rateMinor).toBe(3000);
    expect(entry?.rateCurrency).toBe("EUR");
    // No member rate here, so no internal cost is recorded.
    expect(entry?.internalCostMinor).toBeNull();
  });

  it("uses the member rate over the client default and freezes the cost", async () => {
    const entry = await logManualEntry(db, businessA.id, userA, {
      taskId: memberClientTask.id,
      startedAt: new Date("2026-06-10T10:00:00Z"),
      durationSeconds: 3600,
      billable: true,
    });
    // Bill EUR 320.00/day -> 40.00/h; cost EUR 280.00/day -> 35.00/h.
    expect(entry?.rateMinor).toBe(4000);
    expect(entry?.rateCurrency).toBe("EUR");
    expect(entry?.internalCostMinor).toBe(3500);
    expect(entry?.internalCostCurrency).toBe("EUR");
  });

  it("keeps the member internal cost even under a manual bill-rate override", async () => {
    const entry = await logManualEntry(db, businessA.id, userA, {
      taskId: memberClientTask.id,
      startedAt: new Date("2026-06-10T11:00:00Z"),
      durationSeconds: 3600,
      billable: true,
      rateMinor: 9999,
      rateCurrency: "EUR",
    });
    expect(entry?.rateMinor).toBe(9999);
    // The override changes what's billed, not what the worker costs.
    expect(entry?.internalCostMinor).toBe(3500);
  });

  it("does not apply a member rate from another business", async () => {
    // userB has no member rate on businessA's member client (and isn't even a
    // member of it). Their entry there would fail tenancy anyway; assert the
    // member rate is scoped to its own business by checking userB on businessB
    // gets no internal cost while userA on businessA does.
    const entry = await logManualEntry(db, businessB.id, userB, {
      taskId: taskB.id,
      startedAt: new Date("2026-06-10T12:00:00Z"),
      durationSeconds: 3600,
      billable: true,
    });
    expect(entry?.internalCostMinor).toBeNull();
  });
});

describe("time service - week listing", () => {
  it("returns only the caller's closed entries inside the window", async () => {
    const weekStart = new Date("2026-06-01T00:00:00Z");
    const weekEnd = new Date("2026-06-08T00:00:00Z");

    await logManualEntry(db, businessA.id, userA, {
      taskId: taskClientRate.id,
      startedAt: new Date("2026-06-02T09:00:00Z"),
      durationSeconds: 5400,
      billable: true,
      note: "in window",
    });
    // Outside the window, same user
    await logManualEntry(db, businessA.id, userA, {
      taskId: taskClientRate.id,
      startedAt: new Date("2026-06-09T09:00:00Z"),
      durationSeconds: 3600,
      billable: true,
    });
    // Inside the window, other business/user
    await logManualEntry(db, businessB.id, userB, {
      taskId: taskB.id,
      startedAt: new Date("2026-06-02T10:00:00Z"),
      durationSeconds: 3600,
      billable: true,
    });

    const rows = await listEntriesBetween(
      db,
      businessA.id,
      userA,
      weekStart,
      weekEnd,
    );
    expect(rows.some((r) => r.note === "in window")).toBe(true);
    expect(
      rows.every(
        (r) =>
          r.startedAt >= weekStart &&
          r.startedAt < weekEnd &&
          r.taskTitle !== "Beta task",
      ),
    ).toBe(true);
    const inWindow = rows.find((r) => r.note === "in window");
    expect(inWindow?.projectName).toBe("Plain project");
    expect(inWindow?.clientName).toBe("Alpha client");
  });
});

describe("time service - timer lifecycle", () => {
  it("starts, reports and stops a timer with exact seconds", async () => {
    const started = await startTimer(db, businessA.id, userA, taskClientRate.id);
    expect(started?.endedAt).toBeNull();

    const running = await getRunningTimer(db, businessA.id, userA);
    expect(running?.taskId).toBe(taskClientRate.id);
    expect(running?.taskTitle).toBe("Client-rate task");

    const stopped = await stopTimer(db, businessA.id, userA);
    expect(stopped?.durationSeconds).toBeGreaterThanOrEqual(1);
    expect(stopped?.endedAt).toBeInstanceOf(Date);

    expect(await getRunningTimer(db, businessA.id, userA)).toBeNull();
  });

  it("starting a second timer stops the first without losing time", async () => {
    await startTimer(db, businessA.id, userA, taskClientRate.id);
    const second = await startTimer(db, businessA.id, userA, taskProjectRate.id);
    expect(second?.taskId).toBe(taskProjectRate.id);

    const running = await getRunningTimer(db, businessA.id, userA);
    expect(running?.taskId).toBe(taskProjectRate.id);

    // The first timer was closed with a recorded duration, not discarded.
    const firstTaskEntries = await listEntriesForTask(
      db,
      businessA.id,
      taskClientRate.id,
    );
    const closed = firstTaskEntries.filter((e) => e.endedAt !== null);
    expect(closed.length).toBeGreaterThanOrEqual(1);
    expect(closed.every((e) => (e.durationSeconds ?? 0) >= 1)).toBe(true);

    await stopTimer(db, businessA.id, userA);
  });

  it("timers are per user - one user's stop does not touch another's", async () => {
    await startTimer(db, businessB.id, userB, taskB.id);
    expect(await stopTimer(db, businessA.id, userA)).toBeNull();
    const stillRunning = await getRunningTimer(db, businessB.id, userB);
    expect(stillRunning?.taskId).toBe(taskB.id);
    await stopTimer(db, businessB.id, userB);
  });
});
