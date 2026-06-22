import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { getDb } from "@/db";
import {
  addNote,
  archiveClient,
  clientInputSchema,
  createClient,
  getClient,
  importClients,
  listActivity,
  listClients,
  listMemberRates,
  memberRateInputSchema,
  removeMemberRate,
  setMemberRate,
  unarchiveClient,
  updateClient,
} from "@/modules/clients/service";

import { createTRPCRouter, permissionProcedure } from "../init";

// Internal cost is margin-sensitive: only callers who can view profit see it.
// Keeps the public fields; drops the internal-cost ones unless allowed.
type MemberRateRow = Awaited<ReturnType<typeof listMemberRates>>[number];

function publicMemberRate(row: MemberRateRow, canSeeCost: boolean) {
  const base = {
    id: row.id,
    userId: row.userId,
    name: row.name,
    email: row.email,
    billRateMinor: row.billRateMinor,
    billRateCurrency: row.billRateCurrency,
    billRateUnit: row.billRateUnit,
    budgetMinor: row.budgetMinor,
    budgetCurrency: row.budgetCurrency,
  };
  return canSeeCost
    ? {
        ...base,
        internalCostMinor: row.internalCostMinor,
        internalCostCurrency: row.internalCostCurrency,
        internalCostUnit: row.internalCostUnit,
      }
    : base;
}

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
  list: permissionProcedure("clients.view")
    .input(z.object({ includeArchived: z.boolean().default(false) }).optional())
    .query(({ ctx, input }) =>
      listClients(getDb(), ctx.businessId, {
        includeArchived: input?.includeArchived ?? false,
      }),
    ),

  get: permissionProcedure("clients.view")
    .input(clientIdInput)
    .query(async ({ ctx, input }) =>
      found(await getClient(getDb(), ctx.businessId, input.clientId)),
    ),

  create: permissionProcedure("clients.create")
    .input(clientInputSchema)
    .mutation(({ ctx, input }) =>
      createClient(getDb(), ctx.businessId, ctx.session.user.id, input),
    ),

  update: permissionProcedure("clients.edit")
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

  archive: permissionProcedure("clients.archive")
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

  unarchive: permissionProcedure("clients.archive")
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

  activity: permissionProcedure("clients.view")
    .input(clientIdInput)
    .query(async ({ ctx, input }) => {
      found(await getClient(getDb(), ctx.businessId, input.clientId));
      return listActivity(getDb(), ctx.businessId, input.clientId);
    }),

  importMany: permissionProcedure("clients.create")
    .input(
      z.object({
        // One wizard batch; bigger files import in chunks client-side.
        rows: z.array(clientInputSchema).min(1).max(500),
      }),
    )
    .mutation(({ ctx, input }) =>
      importClients(getDb(), ctx.businessId, ctx.session.user.id, input.rows),
    ),

  addNote: permissionProcedure("clients.edit")
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

  // Per-client team-member rates. Viewing requires only clients.view (rates
  // appear on the client page), but internal cost is hidden without
  // reports.viewProfit. Editing requires clients.manageRates.
  listMemberRates: permissionProcedure("clients.view")
    .input(clientIdInput)
    .query(async ({ ctx, input }) => {
      const canSeeCost = ctx.permissions.has("reports.viewProfit");
      const rows = await listMemberRates(
        getDb(),
        ctx.businessId,
        input.clientId,
      );
      return rows.map((row) => publicMemberRate(row, canSeeCost));
    }),

  setMemberRate: permissionProcedure("clients.manageRates")
    .input(clientIdInput.extend({ data: memberRateInputSchema }))
    .mutation(async ({ ctx, input }) => {
      const result = await setMemberRate(
        getDb(),
        ctx.businessId,
        input.clientId,
        input.data,
        // Only persist internal cost when the caller is allowed to set it.
        { allowInternalCost: ctx.permissions.has("reports.viewProfit") },
      );
      if (!result.ok) {
        throw new TRPCError({
          code: result.reason === "client_not_found" ? "NOT_FOUND" : "BAD_REQUEST",
          message:
            result.reason === "client_not_found"
              ? "No such client"
              : "That person isn't on your team",
        });
      }
      return result.rate;
    }),

  removeMemberRate: permissionProcedure("clients.manageRates")
    .input(clientIdInput.extend({ userId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) =>
      found(
        await removeMemberRate(
          getDb(),
          ctx.businessId,
          input.clientId,
          input.userId,
        ),
      ),
    ),
});
