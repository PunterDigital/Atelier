import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { getDb } from "@/db";
import {
  acceptInvitation,
  getInvitationPreview,
  inviteInputSchema,
  inviteMember,
  listMembers,
  listPendingInvitations,
  removeMember,
  revokeInvitation,
} from "@/modules/team/service";

import {
  authedProcedure,
  businessProcedure,
  createTRPCRouter,
  publicProcedure,
} from "../init";

function assertOwner(role: string) {
  if (role !== "owner") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only the business owner can manage the team",
    });
  }
}

export const teamRouter = createTRPCRouter({
  // Any member can see who's on the team; only owners get the pending
  // invitations (they carry the live invite tokens).
  list: businessProcedure.query(async ({ ctx }) => {
    const members = await listMembers(getDb(), ctx.businessId);
    const invitations =
      ctx.businessRole === "owner"
        ? await listPendingInvitations(getDb(), ctx.businessId)
        : [];
    return { members, invitations, role: ctx.businessRole };
  }),

  invite: businessProcedure
    .input(inviteInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertOwner(ctx.businessRole);
      const result = await inviteMember(
        getDb(),
        ctx.businessId,
        ctx.session.user.id,
        input,
      );
      if (!result.ok) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            result.reason === "already_member"
              ? "That person is already on your team"
              : "There's already a pending invite for that email - revoke it to send a new one",
        });
      }
      return result.invitation;
    }),

  revoke: businessProcedure
    .input(z.object({ invitationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      assertOwner(ctx.businessRole);
      const revoked = await revokeInvitation(
        getDb(),
        ctx.businessId,
        input.invitationId,
      );
      if (!revoked) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No such pending invitation",
        });
      }
      return revoked;
    }),

  removeMember: businessProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertOwner(ctx.businessRole);
      const result = await removeMember(getDb(), ctx.businessId, input.userId);
      if (!result.ok) {
        throw new TRPCError({
          code: result.reason === "last_owner" ? "PRECONDITION_FAILED" : "NOT_FOUND",
          message:
            result.reason === "last_owner"
              ? "You can't remove the last owner - make someone else an owner first"
              : "That person isn't on your team",
        });
      }
      return { ok: true };
    }),

  // Public: the accept screen renders for signed-out visitors too (to prompt
  // sign-in). The token is the credential; only minimal detail is returned.
  preview: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(({ input }) => getInvitationPreview(getDb(), input.token)),

  // Authed but not business-scoped: a brand-new user accepting their first
  // invite has no active business yet.
  accept: authedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await acceptInvitation(
        getDb(),
        ctx.session.user.id,
        input.token,
      );
      if (!result.ok) {
        const message =
          result.reason === "expired"
            ? "This invite has expired - ask for a new one"
            : "This invite is no longer valid";
        throw new TRPCError({ code: "BAD_REQUEST", message });
      }
      return result;
    }),
});
