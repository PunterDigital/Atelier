import { and, asc, desc, eq, gte, isNotNull, isNull, lt } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/db";
import { schema } from "@/db";

// Time tracking. Tenancy contract as everywhere: businessId scopes every
// query. Durations are exact seconds (billing spec Section 7). Rates are
// resolved once, at entry creation, with the spec's precedence
// (manual entry rate > project default > client default) and stored with
// their currency. How a stored rate currency interacts with a different
// invoice currency is an open spec question (see ESCALATIONS.md) owned by
// the billing module - this module only records data.

export const manualEntrySchema = z.object({
  taskId: z.string().uuid(),
  startedAt: z.date(),
  durationSeconds: z
    .number()
    .int()
    .positive()
    .max(7 * 24 * 3600),
  billable: z.boolean().default(true),
  note: z.string().trim().max(1000).optional(),
  // Manual override; when absent the project/client default applies.
  rateMinor: z.number().int().nonnegative().nullable().optional(),
  rateCurrency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/)
    .nullable()
    .optional(),
});

export type ManualEntryInput = z.infer<typeof manualEntrySchema>;

type TaskScope = {
  taskId: string;
  projectRateMinor: number | null;
  projectRateCurrency: string | null;
  clientRateMinor: number | null;
  clientRateCurrency: string | null;
};

async function taskInBusiness(
  db: Db,
  businessId: string,
  taskId: string,
): Promise<TaskScope | null> {
  const [row] = await db
    .select({
      taskId: schema.task.id,
      projectRateMinor: schema.project.defaultRateMinor,
      projectRateCurrency: schema.project.defaultRateCurrency,
      clientRateMinor: schema.client.defaultRateMinor,
      clientRateCurrency: schema.client.defaultRateCurrency,
    })
    .from(schema.task)
    .innerJoin(schema.project, eq(schema.task.projectId, schema.project.id))
    .innerJoin(schema.client, eq(schema.project.clientId, schema.client.id))
    .where(
      and(eq(schema.task.businessId, businessId), eq(schema.task.id, taskId)),
    );
  return row ?? null;
}

// Billing spec Section 7: entry-level rate if set manually, else the
// project's default, else the client's default. Resolved exactly once.
function resolveRate(
  scope: TaskScope,
  manual: { rateMinor?: number | null; rateCurrency?: string | null },
): { rateMinor: number | null; rateCurrency: string | null } {
  if (manual.rateMinor != null && manual.rateCurrency) {
    return { rateMinor: manual.rateMinor, rateCurrency: manual.rateCurrency };
  }
  if (scope.projectRateMinor != null && scope.projectRateCurrency) {
    return {
      rateMinor: scope.projectRateMinor,
      rateCurrency: scope.projectRateCurrency,
    };
  }
  if (scope.clientRateMinor != null && scope.clientRateCurrency) {
    return {
      rateMinor: scope.clientRateMinor,
      rateCurrency: scope.clientRateCurrency,
    };
  }
  return { rateMinor: null, rateCurrency: null };
}

export async function getRunningTimer(db: Db, businessId: string, userId: string) {
  const [row] = await db
    .select({
      id: schema.timeEntry.id,
      taskId: schema.timeEntry.taskId,
      startedAt: schema.timeEntry.startedAt,
      taskTitle: schema.task.title,
      projectId: schema.task.projectId,
    })
    .from(schema.timeEntry)
    .innerJoin(schema.task, eq(schema.timeEntry.taskId, schema.task.id))
    .where(
      and(
        eq(schema.timeEntry.businessId, businessId),
        eq(schema.timeEntry.userId, userId),
        isNull(schema.timeEntry.endedAt),
      ),
    );
  return row ?? null;
}

// Starting a timer stops any running one first (one active task per user,
// like the design kit's board) - switching tasks must never lose time.
export async function startTimer(
  db: Db,
  businessId: string,
  userId: string,
  taskId: string,
) {
  const scope = await taskInBusiness(db, businessId, taskId);
  if (!scope) {
    return null;
  }
  return db.transaction(async (tx) => {
    await stopTimerTx(tx, businessId, userId);
    const rate = resolveRate(scope, {});
    const [created] = await tx
      .insert(schema.timeEntry)
      .values({
        businessId,
        taskId,
        userId,
        startedAt: new Date(),
        billable: true,
        rateMinor: rate.rateMinor,
        rateCurrency: rate.rateCurrency,
      })
      .returning();
    return created;
  });
}

async function stopTimerTx(db: Db, businessId: string, userId: string) {
  const [running] = await db
    .select()
    .from(schema.timeEntry)
    .where(
      and(
        eq(schema.timeEntry.businessId, businessId),
        eq(schema.timeEntry.userId, userId),
        isNull(schema.timeEntry.endedAt),
      ),
    );
  if (!running) {
    return null;
  }
  const endedAt = new Date();
  const durationSeconds = Math.max(
    1,
    Math.round((endedAt.getTime() - running.startedAt.getTime()) / 1000),
  );
  const [stopped] = await db
    .update(schema.timeEntry)
    .set({ endedAt, durationSeconds, updatedAt: endedAt })
    .where(eq(schema.timeEntry.id, running.id))
    .returning();
  return stopped;
}

export async function stopTimer(db: Db, businessId: string, userId: string) {
  return stopTimerTx(db, businessId, userId);
}

export async function logManualEntry(
  db: Db,
  businessId: string,
  userId: string,
  input: ManualEntryInput,
) {
  const scope = await taskInBusiness(db, businessId, input.taskId);
  if (!scope) {
    return null;
  }
  const rate = resolveRate(scope, {
    rateMinor: input.rateMinor,
    rateCurrency: input.rateCurrency,
  });
  const endedAt = new Date(
    input.startedAt.getTime() + input.durationSeconds * 1000,
  );
  const [created] = await db
    .insert(schema.timeEntry)
    .values({
      businessId,
      taskId: input.taskId,
      userId,
      startedAt: input.startedAt,
      endedAt,
      durationSeconds: input.durationSeconds,
      billable: input.billable,
      note: input.note ?? null,
      rateMinor: rate.rateMinor,
      rateCurrency: rate.rateCurrency,
    })
    .returning();
  return created;
}

export async function listEntriesForTask(
  db: Db,
  businessId: string,
  taskId: string,
) {
  return db
    .select()
    .from(schema.timeEntry)
    .where(
      and(
        eq(schema.timeEntry.businessId, businessId),
        eq(schema.timeEntry.taskId, taskId),
      ),
    )
    .orderBy(desc(schema.timeEntry.startedAt));
}

// Closed entries for one user in [from, to), joined with task/project/
// client names for the timesheet. Running timers are excluded - they
// appear once stopped.
export async function listEntriesBetween(
  db: Db,
  businessId: string,
  userId: string,
  from: Date,
  to: Date,
) {
  return db
    .select({
      id: schema.timeEntry.id,
      startedAt: schema.timeEntry.startedAt,
      durationSeconds: schema.timeEntry.durationSeconds,
      billable: schema.timeEntry.billable,
      note: schema.timeEntry.note,
      taskId: schema.timeEntry.taskId,
      taskTitle: schema.task.title,
      projectId: schema.task.projectId,
      projectName: schema.project.name,
      clientName: schema.client.name,
    })
    .from(schema.timeEntry)
    .innerJoin(schema.task, eq(schema.timeEntry.taskId, schema.task.id))
    .innerJoin(schema.project, eq(schema.task.projectId, schema.project.id))
    .innerJoin(schema.client, eq(schema.project.clientId, schema.client.id))
    .where(
      and(
        eq(schema.timeEntry.businessId, businessId),
        eq(schema.timeEntry.userId, userId),
        isNotNull(schema.timeEntry.endedAt),
        gte(schema.timeEntry.startedAt, from),
        lt(schema.timeEntry.startedAt, to),
      ),
    )
    .orderBy(asc(schema.timeEntry.startedAt));
}

export async function deleteEntry(db: Db, businessId: string, entryId: string) {
  const [deleted] = await db
    .delete(schema.timeEntry)
    .where(
      and(
        eq(schema.timeEntry.businessId, businessId),
        eq(schema.timeEntry.id, entryId),
      ),
    )
    .returning();
  return deleted ?? null;
}
