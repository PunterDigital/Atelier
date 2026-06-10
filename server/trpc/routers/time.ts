import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { getDb } from "@/db";
import {
  deleteEntry,
  getRunningTimer,
  listEntriesForTask,
  logManualEntry,
  manualEntrySchema,
  startTimer,
  stopTimer,
} from "@/modules/time/service";

import { businessProcedure, createTRPCRouter } from "../init";

function found<T>(row: T | null): T {
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "No such entry" });
  }
  return row;
}

export const timeRouter = createTRPCRouter({
  running: businessProcedure.query(({ ctx }) =>
    getRunningTimer(getDb(), ctx.businessId, ctx.session.user.id),
  ),

  start: businessProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) =>
      found(
        await startTimer(getDb(), ctx.businessId, ctx.session.user.id, input.taskId),
      ),
    ),

  // Stopping when nothing runs is a no-op, not an error - the timer may
  // have been stopped from another tab.
  stop: businessProcedure.mutation(({ ctx }) =>
    stopTimer(getDb(), ctx.businessId, ctx.session.user.id),
  ),

  logManual: businessProcedure
    .input(manualEntrySchema)
    .mutation(async ({ ctx, input }) =>
      found(
        await logManualEntry(getDb(), ctx.businessId, ctx.session.user.id, input),
      ),
    ),

  listForTask: businessProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      listEntriesForTask(getDb(), ctx.businessId, input.taskId),
    ),

  deleteEntry: businessProcedure
    .input(z.object({ entryId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) =>
      found(await deleteEntry(getDb(), ctx.businessId, input.entryId)),
    ),
});
