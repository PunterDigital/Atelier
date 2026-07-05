import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { getDb } from "@/db";
import {
  createProject,
  getProject,
  listProjects,
  projectInputSchema,
  updateProject,
} from "@/modules/projects/service";

import { createTRPCRouter, permissionProcedure } from "../init";

function found<T>(row: T | null): T {
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "No such project" });
  }
  return row;
}

export const projectsRouter = createTRPCRouter({
  list: permissionProcedure("projects.view")
    .input(
      z
        .object({
          clientId: z.string().uuid().optional(),
          search: z.string().optional(),
        })
        .optional(),
    )
    .query(({ ctx, input }) =>
      listProjects(getDb(), ctx.businessId, {
        clientId: input?.clientId,
        search: input?.search,
      }),
    ),

  get: permissionProcedure("projects.view")
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) =>
      found(await getProject(getDb(), ctx.businessId, input.projectId)),
    ),

  create: permissionProcedure("projects.create")
    .input(projectInputSchema)
    .mutation(async ({ ctx, input }) =>
      found(
        await createProject(getDb(), ctx.businessId, ctx.session.user.id, input),
      ),
    ),

  update: permissionProcedure("projects.edit")
    .input(z.object({ projectId: z.string().uuid(), data: projectInputSchema }))
    .mutation(async ({ ctx, input }) =>
      found(
        await updateProject(getDb(), ctx.businessId, input.projectId, input.data),
      ),
    ),
});
