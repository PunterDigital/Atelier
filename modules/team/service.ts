import { randomBytes } from "node:crypto";

import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/db";
import { schema } from "@/db";

// Team membership and invitations. Every query is scoped by businessId (the
// tenancy boundary), except invitation lookup by token - the token is itself
// the unguessable secret that authorises the accept.

const INVITE_TTL_DAYS = 7;

export const inviteInputSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  role: z.enum(["owner", "member"]).default("member"),
});

export type InviteInput = z.infer<typeof inviteInputSchema>;

// Current members with their user details, oldest first (the founder leads).
export async function listMembers(db: Db, businessId: string) {
  return db
    .select({
      userId: schema.businessMember.userId,
      role: schema.businessMember.role,
      joinedAt: schema.businessMember.createdAt,
      name: schema.user.name,
      email: schema.user.email,
    })
    .from(schema.businessMember)
    .innerJoin(schema.user, eq(schema.businessMember.userId, schema.user.id))
    .where(eq(schema.businessMember.businessId, businessId))
    .orderBy(asc(schema.businessMember.createdAt));
}

// Pending invitations for the business, newest first. Carries the token so an
// owner can re-copy the link; only ever returned to owners (router-enforced).
export async function listPendingInvitations(db: Db, businessId: string) {
  return db
    .select()
    .from(schema.businessInvitation)
    .where(
      and(
        eq(schema.businessInvitation.businessId, businessId),
        eq(schema.businessInvitation.status, "pending"),
      ),
    )
    .orderBy(asc(schema.businessInvitation.createdAt));
}

type InviteResult =
  | { ok: true; invitation: typeof schema.businessInvitation.$inferSelect }
  | { ok: false; reason: "already_member" | "already_invited" };

export async function inviteMember(
  db: Db,
  businessId: string,
  invitedByUserId: string,
  input: InviteInput,
): Promise<InviteResult> {
  const email = input.email.trim().toLowerCase();

  // Already on the team? (case-insensitive email match against members)
  const members = await db
    .select({ email: schema.user.email })
    .from(schema.businessMember)
    .innerJoin(schema.user, eq(schema.businessMember.userId, schema.user.id))
    .where(eq(schema.businessMember.businessId, businessId));
  if (members.some((m) => m.email.trim().toLowerCase() === email)) {
    return { ok: false, reason: "already_member" };
  }

  // One live invite per email - revoke the old one first to re-invite.
  const pending = await listPendingInvitations(db, businessId);
  if (pending.some((p) => p.email === email)) {
    return { ok: false, reason: "already_invited" };
  }

  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 3600 * 1000);
  const [invitation] = await db
    .insert(schema.businessInvitation)
    .values({
      businessId,
      email,
      role: input.role,
      token: randomBytes(24).toString("base64url"),
      invitedByUserId,
      expiresAt,
    })
    .returning();
  return { ok: true, invitation };
}

export async function revokeInvitation(
  db: Db,
  businessId: string,
  invitationId: string,
) {
  const [updated] = await db
    .update(schema.businessInvitation)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(
      and(
        eq(schema.businessInvitation.businessId, businessId),
        eq(schema.businessInvitation.id, invitationId),
        eq(schema.businessInvitation.status, "pending"),
      ),
    )
    .returning();
  return updated ?? null;
}

// Token lookup for the accept screen. Unscoped by business on purpose: the
// token is the credential. Returns just enough to render the invite, plus a
// computed validity so the page can branch without re-deriving the rules.
export async function getInvitationPreview(db: Db, token: string) {
  const [row] = await db
    .select({
      email: schema.businessInvitation.email,
      role: schema.businessInvitation.role,
      status: schema.businessInvitation.status,
      expiresAt: schema.businessInvitation.expiresAt,
      businessName: schema.business.name,
    })
    .from(schema.businessInvitation)
    .innerJoin(
      schema.business,
      eq(schema.businessInvitation.businessId, schema.business.id),
    )
    .where(eq(schema.businessInvitation.token, token));
  if (!row) return null;
  const valid = row.status === "pending" && row.expiresAt > new Date();
  return { ...row, valid };
}

type AcceptResult =
  | { ok: true; businessId: string; alreadyMember: boolean }
  | { ok: false; reason: "invalid" | "expired" | "not_pending" };

// Accept by token. The accepting user need not already belong to any business
// (a fresh sign-up joining their first team), so this is authed-only, not
// business-scoped. Idempotent: re-accepting when already a member is a no-op
// success, never a duplicate membership.
export async function acceptInvitation(
  db: Db,
  userId: string,
  token: string,
): Promise<AcceptResult> {
  return db.transaction(async (tx) => {
    const [invite] = await tx
      .select()
      .from(schema.businessInvitation)
      .where(eq(schema.businessInvitation.token, token));
    if (!invite) return { ok: false, reason: "invalid" };
    if (invite.status !== "pending") return { ok: false, reason: "not_pending" };
    if (invite.expiresAt <= new Date()) return { ok: false, reason: "expired" };

    const [existing] = await tx
      .select({ id: schema.businessMember.id })
      .from(schema.businessMember)
      .where(
        and(
          eq(schema.businessMember.businessId, invite.businessId),
          eq(schema.businessMember.userId, userId),
        ),
      );
    if (!existing) {
      await tx.insert(schema.businessMember).values({
        businessId: invite.businessId,
        userId,
        role: invite.role,
      });
    }
    await tx
      .update(schema.businessInvitation)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
        acceptedByUserId: userId,
        updatedAt: new Date(),
      })
      .where(eq(schema.businessInvitation.id, invite.id));

    return { ok: true, businessId: invite.businessId, alreadyMember: !!existing };
  });
}

type RemoveResult =
  | { ok: true }
  | { ok: false; reason: "not_member" | "last_owner" };

// Remove a member. The last owner cannot be removed - a business must always
// have someone who can administer it.
export async function removeMember(
  db: Db,
  businessId: string,
  targetUserId: string,
): Promise<RemoveResult> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        userId: schema.businessMember.userId,
        role: schema.businessMember.role,
      })
      .from(schema.businessMember)
      .where(eq(schema.businessMember.businessId, businessId));

    const target = rows.find((r) => r.userId === targetUserId);
    if (!target) return { ok: false, reason: "not_member" };
    const owners = rows.filter((r) => r.role === "owner");
    if (target.role === "owner" && owners.length <= 1) {
      return { ok: false, reason: "last_owner" };
    }

    await tx
      .delete(schema.businessMember)
      .where(
        and(
          eq(schema.businessMember.businessId, businessId),
          eq(schema.businessMember.userId, targetUserId),
        ),
      );
    return { ok: true };
  });
}
