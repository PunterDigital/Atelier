import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { schema, type Db } from "@/db";
import { generateLinesFromUnbilledTime } from "@/modules/billing/generate";
import {
  createDraftInvoice,
  deleteDraftInvoice,
} from "@/modules/billing/invoices";
import { createClient } from "@/modules/clients/service";
import { logManualEntry } from "@/modules/time/service";
import { createTestDatabase } from "@/db/testing";

import { createProject } from "./service";
import {
  createTask,
  deleteTask,
  listTasks,
  searchTasks,
  setTaskStatus,
  updateTask,
} from "./tasks-service";

let pglite: PGlite;
let db: Db;

let businessA: { id: string };
let businessB: { id: string };
let clientA: { id: string };
let projectA: { id: string };
let projectB: { id: string };
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
  clientA = await createClient(db, businessA.id, userA, {
    name: "Alpha client",
    contacts: [],
  });
  const clientB = await createClient(db, businessB.id, userB, {
    name: "Beta client",
    contacts: [],
  });
  projectA = (await createProject(db, businessA.id, userA, {
    name: "Alpha project",
    clientId: clientA.id,
    status: "active",
  })) as { id: string };
  projectB = (await createProject(db, businessB.id, userB, {
    name: "Beta project",
    clientId: clientB.id,
    status: "active",
  })) as { id: string };
});

afterAll(async () => {
  await pglite.close();
});

describe("tasks service - cross-business isolation", () => {
  it("refuses to create a task on another business's project", async () => {
    expect(
      await createTask(db, businessA.id, projectB.id, {
        title: "Intrusion",
        status: "todo",
      }),
    ).toBeNull();
  });

  it("denies update, move and delete on another business's task", async () => {
    const target = await createTask(db, businessB.id, projectB.id, {
      title: "Beta task",
      status: "todo",
    });
    const targetId = (target as { id: string }).id;

    expect(
      await updateTask(db, businessA.id, targetId, {
        title: "hijacked",
        status: "done",
      }),
    ).toBeNull();
    expect(await setTaskStatus(db, businessA.id, targetId, "done")).toBeNull();
    expect(await deleteTask(db, businessA.id, targetId)).toEqual({
      ok: false,
      reason: "not_found",
    });

    const [untouched] = await listTasks(db, businessB.id, projectB.id);
    expect(untouched.title).toBe("Beta task");
    expect(untouched.status).toBe("todo");
  });
});

describe("tasks service - lifecycle", () => {
  it("creates, lists, moves, updates and deletes within a project", async () => {
    const created = await createTask(db, businessA.id, projectA.id, {
      title: "Design the board",
      status: "todo",
      estimateMinutes: 180,
    });
    expect(created?.estimateMinutes).toBe(180);

    const moved = await setTaskStatus(
      db,
      businessA.id,
      (created as { id: string }).id,
      "in_progress",
    );
    expect(moved?.status).toBe("in_progress");

    const updated = await updateTask(
      db,
      businessA.id,
      (created as { id: string }).id,
      { title: "Design the kanban board", status: "in_review", estimateMinutes: null },
    );
    expect(updated?.title).toBe("Design the kanban board");
    expect(updated?.estimateMinutes).toBeNull();

    const list = await listTasks(db, businessA.id, projectA.id);
    expect(list).toHaveLength(1);

    const deleted = await deleteTask(
      db,
      businessA.id,
      (created as { id: string }).id,
    );
    expect(deleted.ok).toBe(true);
    expect(await listTasks(db, businessA.id, projectA.id)).toEqual([]);
  });

  it("deleting a task cascades to its time entries", async () => {
    const task = (await createTask(db, businessA.id, projectA.id, {
      title: "Task with tracked time",
      status: "in_progress",
    })) as { id: string };

    await db.insert(schema.timeEntry).values({
      businessId: businessA.id,
      taskId: task.id,
      userId: userA,
      startedAt: new Date("2026-01-01T09:00:00.000Z"),
      endedAt: new Date("2026-01-01T10:00:00.000Z"),
      durationSeconds: 3600,
    });

    const deleted = await deleteTask(db, businessA.id, task.id);
    expect(deleted.ok).toBe(true);

    // The FK is ON DELETE cascade, so the entry is gone with the task
    // rather than the delete failing on a constraint violation.
    const entries = await db
      .select()
      .from(schema.timeEntry)
      .where(eq(schema.timeEntry.taskId, task.id));
    expect(entries).toEqual([]);
  });

  it("refuses to delete a task whose time is billed, until it is released", async () => {
    const task = (await createTask(db, businessA.id, projectA.id, {
      title: "Task with billed time",
      status: "in_progress",
    })) as { id: string };
    await logManualEntry(db, businessA.id, userA, {
      taskId: task.id,
      startedAt: new Date("2026-06-10T09:00:00Z"),
      durationSeconds: 3600,
      billable: true,
      rateMinor: 6000,
      rateCurrency: "GBP",
    });

    const draft = (await createDraftInvoice(db, businessA.id, {
      clientId: clientA.id,
      currency: "GBP",
      taxTreatment: "zero_rated",
    })) as { id: string };
    const generated = await generateLinesFromUnbilledTime(db, businessA.id, {
      invoiceId: draft.id,
      grouping: "task",
    });
    expect(generated).toMatchObject({ ok: true, lineCount: 1 });

    // Billed time blocks the delete - the tracked hour must not vanish.
    expect(await deleteTask(db, businessA.id, task.id)).toEqual({
      ok: false,
      reason: "billed_time",
    });

    // Deleting the draft releases the time; the task can go now.
    expect(await deleteDraftInvoice(db, businessA.id, draft.id)).not.toBeNull();
    const deleted = await deleteTask(db, businessA.id, task.id);
    expect(deleted.ok).toBe(true);
  });
});

describe("tasks service - search", () => {
  it("searches titles across the business's projects, scoped to the caller", async () => {
    await createTask(db, businessA.id, projectA.id, {
      title: "Wire up the payment webhook",
      status: "todo",
    });
    await createTask(db, businessA.id, projectA.id, {
      title: "Draft onboarding email",
      status: "in_progress",
    });
    // A same-titled task in another business must stay invisible here.
    await createTask(db, businessB.id, projectB.id, {
      title: "Wire up the payment webhook",
      status: "todo",
    });

    const hits = await searchTasks(db, businessA.id, "webhook");
    expect(hits).toHaveLength(1);
    expect(hits[0].title).toBe("Wire up the payment webhook");
    // Results carry the parent project and client for context/linking.
    expect(hits[0].projectId).toBe(projectA.id);
    expect(hits[0].projectName).toBe("Alpha project");
    expect(hits[0].clientName).toBe("Alpha client");

    // An empty term returns nothing rather than every task.
    expect(await searchTasks(db, businessA.id, "   ")).toEqual([]);
    // No match returns an empty list.
    expect(await searchTasks(db, businessA.id, "zzzzz")).toEqual([]);
  });
});
