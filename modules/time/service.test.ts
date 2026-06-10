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
  deleteEntry,
  getRunningTimer,
  listEntriesBetween,
  listEntriesForTask,
  logManualEntry,
  startTimer,
  stopTimer,
} from "./service";

const migrationsFolder = fileURLToPath(
  new URL("../../db/migrations", import.meta.url),
);

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
  pglite = new PGlite();
  const pgliteDb = drizzle(pglite, { schema });
  await migrate(pgliteDb, { migrationsFolder });
  db = pgliteDb;

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
