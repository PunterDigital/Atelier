import { and, asc, eq, getTableColumns, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/db";
import { schema } from "@/db";

// Tasks live inside the projects module (the repo map: projects owns
// projects + tasks). Same tenancy contract: businessId on every query,
// and a task can only ever attach to a project of the same business.

export const taskStatusSchema = z.enum([
  "todo",
  "in_progress",
  "in_review",
  "done",
]);

export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const taskInputSchema = z.object({
  title: z.string().trim().min(1).max(300),
  status: taskStatusSchema.default("todo"),
  estimateMinutes: z.number().int().positive().max(60 * 1000).nullable().optional(),
});

export type TaskInput = z.infer<typeof taskInputSchema>;

async function projectInBusiness(
  db: Db,
  businessId: string,
  projectId: string,
) {
  const [row] = await db
    .select({ id: schema.project.id })
    .from(schema.project)
    .where(
      and(
        eq(schema.project.businessId, businessId),
        eq(schema.project.id, projectId),
      ),
    );
  return Boolean(row);
}

export async function listTasks(db: Db, businessId: string, projectId: string) {
  // trackedSeconds sums the task's closed entries (running timers join in
  // once stopped); pg returns the aggregate as a string, hence Number().
  const rows = await db
    .select({
      ...getTableColumns(schema.task),
      trackedSeconds: sql<string>`coalesce(sum(${schema.timeEntry.durationSeconds}), 0)`,
    })
    .from(schema.task)
    .leftJoin(
      schema.timeEntry,
      and(
        eq(schema.timeEntry.taskId, schema.task.id),
        isNotNull(schema.timeEntry.endedAt),
      ),
    )
    .where(
      and(
        eq(schema.task.businessId, businessId),
        eq(schema.task.projectId, projectId),
      ),
    )
    .groupBy(schema.task.id)
    .orderBy(asc(schema.task.createdAt));
  return rows.map((row) => ({
    ...row,
    trackedSeconds: Number(row.trackedSeconds),
  }));
}

export async function createTask(
  db: Db,
  businessId: string,
  projectId: string,
  input: TaskInput,
) {
  if (!(await projectInBusiness(db, businessId, projectId))) {
    return null;
  }
  const [created] = await db
    .insert(schema.task)
    .values({
      businessId,
      projectId,
      title: input.title,
      status: input.status,
      estimateMinutes: input.estimateMinutes ?? null,
    })
    .returning();
  return created;
}

export async function updateTask(
  db: Db,
  businessId: string,
  taskId: string,
  input: TaskInput,
) {
  const [updated] = await db
    .update(schema.task)
    .set({
      title: input.title,
      status: input.status,
      estimateMinutes: input.estimateMinutes ?? null,
      updatedAt: new Date(),
    })
    .where(
      and(eq(schema.task.businessId, businessId), eq(schema.task.id, taskId)),
    )
    .returning();
  return updated ?? null;
}

export async function setTaskStatus(
  db: Db,
  businessId: string,
  taskId: string,
  status: TaskStatus,
) {
  const [updated] = await db
    .update(schema.task)
    .set({ status, updatedAt: new Date() })
    .where(
      and(eq(schema.task.businessId, businessId), eq(schema.task.id, taskId)),
    )
    .returning();
  return updated ?? null;
}

export async function deleteTask(db: Db, businessId: string, taskId: string) {
  const [deleted] = await db
    .delete(schema.task)
    .where(
      and(eq(schema.task.businessId, businessId), eq(schema.task.id, taskId)),
    )
    .returning();
  return deleted ?? null;
}
