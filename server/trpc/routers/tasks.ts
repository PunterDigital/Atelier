import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { getDb } from "@/db";
import {
  createTask,
  deleteTask,
  listTasks,
  setTaskStatus,
  taskInputSchema,
  taskStatusSchema,
  updateTask,
} from "@/modules/projects/tasks-service";

import { businessProcedure, createTRPCRouter } from "../init";

function found<T>(row: T | null): T {
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "No such task" });
  }
  return row;
}

export const tasksRouter = createTRPCRouter({
  list: businessProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(({ ctx, input }) => listTasks(getDb(), ctx.businessId, input.projectId)),

  create: businessProcedure
    .input(z.object({ projectId: z.string().uuid(), data: taskInputSchema }))
    .mutation(async ({ ctx, input }) =>
      found(await createTask(getDb(), ctx.businessId, input.projectId, input.data)),
    ),

  update: businessProcedure
    .input(z.object({ taskId: z.string().uuid(), data: taskInputSchema }))
    .mutation(async ({ ctx, input }) =>
      found(await updateTask(getDb(), ctx.businessId, input.taskId, input.data)),
    ),

  setStatus: businessProcedure
    .input(z.object({ taskId: z.string().uuid(), status: taskStatusSchema }))
    .mutation(async ({ ctx, input }) =>
      found(
        await setTaskStatus(getDb(), ctx.businessId, input.taskId, input.status),
      ),
    ),

  delete: businessProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) =>
      found(await deleteTask(getDb(), ctx.businessId, input.taskId)),
    ),
});
