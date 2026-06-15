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

import { createTRPCRouter, permissionProcedure } from "../init";

function found<T>(row: T | null): T {
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "No such task" });
  }
  return row;
}

export const tasksRouter = createTRPCRouter({
  list: permissionProcedure("tasks.view")
    .input(z.object({ projectId: z.string().uuid() }))
    .query(({ ctx, input }) => listTasks(getDb(), ctx.businessId, input.projectId)),

  create: permissionProcedure("tasks.create")
    .input(z.object({ projectId: z.string().uuid(), data: taskInputSchema }))
    .mutation(async ({ ctx, input }) =>
      found(await createTask(getDb(), ctx.businessId, input.projectId, input.data)),
    ),

  update: permissionProcedure("tasks.edit")
    .input(z.object({ taskId: z.string().uuid(), data: taskInputSchema }))
    .mutation(async ({ ctx, input }) =>
      found(await updateTask(getDb(), ctx.businessId, input.taskId, input.data)),
    ),

  setStatus: permissionProcedure("tasks.edit")
    .input(z.object({ taskId: z.string().uuid(), status: taskStatusSchema }))
    .mutation(async ({ ctx, input }) =>
      found(
        await setTaskStatus(getDb(), ctx.businessId, input.taskId, input.status),
      ),
    ),

  delete: permissionProcedure("tasks.delete")
    .input(z.object({ taskId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) =>
      found(await deleteTask(getDb(), ctx.businessId, input.taskId)),
    ),
});
