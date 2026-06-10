import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { getDb } from "@/db";
import {
  addNote,
  archiveClient,
  clientInputSchema,
  createClient,
  getClient,
  listActivity,
  listClients,
  unarchiveClient,
  updateClient,
} from "@/modules/clients/service";

import { businessProcedure, createTRPCRouter } from "../init";

const clientIdInput = z.object({ clientId: z.string().uuid() });

// A client id from another business is indistinguishable from a missing
// record: the service scopes every query by ctx.businessId, so both
// surface here as NOT_FOUND.
function found<T>(row: T | null): T {
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "No such client" });
  }
  return row;
}

export const clientsRouter = createTRPCRouter({
  list: businessProcedure
    .input(z.object({ includeArchived: z.boolean().default(false) }).optional())
    .query(({ ctx, input }) =>
      listClients(getDb(), ctx.businessId, {
        includeArchived: input?.includeArchived ?? false,
      }),
    ),

  get: businessProcedure
    .input(clientIdInput)
    .query(async ({ ctx, input }) =>
      found(await getClient(getDb(), ctx.businessId, input.clientId)),
    ),

  create: businessProcedure
    .input(clientInputSchema)
    .mutation(({ ctx, input }) =>
      createClient(getDb(), ctx.businessId, ctx.session.user.id, input),
    ),

  update: businessProcedure
    .input(clientIdInput.extend({ data: clientInputSchema }))
    .mutation(async ({ ctx, input }) =>
      found(
        await updateClient(
          getDb(),
          ctx.businessId,
          ctx.session.user.id,
          input.clientId,
          input.data,
        ),
      ),
    ),

  archive: businessProcedure
    .input(clientIdInput)
    .mutation(async ({ ctx, input }) =>
      found(
        await archiveClient(
          getDb(),
          ctx.businessId,
          ctx.session.user.id,
          input.clientId,
        ),
      ),
    ),

  unarchive: businessProcedure
    .input(clientIdInput)
    .mutation(async ({ ctx, input }) =>
      found(
        await unarchiveClient(
          getDb(),
          ctx.businessId,
          ctx.session.user.id,
          input.clientId,
        ),
      ),
    ),

  activity: businessProcedure
    .input(clientIdInput)
    .query(async ({ ctx, input }) => {
      found(await getClient(getDb(), ctx.businessId, input.clientId));
      return listActivity(getDb(), ctx.businessId, input.clientId);
    }),

  addNote: businessProcedure
    .input(clientIdInput.extend({ text: z.string().trim().min(1).max(10_000) }))
    .mutation(async ({ ctx, input }) =>
      found(
        await addNote(
          getDb(),
          ctx.businessId,
          ctx.session.user.id,
          input.clientId,
          input.text,
        ),
      ),
    ),
});
