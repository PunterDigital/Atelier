import { PGlite } from "@electric-sql/pglite";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { schema, type Db } from "@/db";
import { createTestDatabase } from "@/db/testing";

import {
  acceptInvitation,
  getInvitationPreview,
  inviteMember,
  listMembers,
  listPendingInvitations,
  removeMember,
  revokeInvitation,
} from "./service";

let pglite: PGlite;
let db: Db;
let alpha: { id: string };
let beta: { id: string };

beforeAll(async () => {
  ({ pglite, db } = await createTestDatabase());

  await db.insert(schema.user).values([
    { id: "owner-a", name: "Owner A", email: "owner-a@test.dev" },
    { id: "owner-b", name: "Owner B", email: "owner-b@test.dev" },
    { id: "newbie", name: "Newbie", email: "newbie@test.dev" },
    { id: "second-owner", name: "Second Owner", email: "second@test.dev" },
  ]);
  [alpha] = await db
    .insert(schema.business)
    .values({ name: "Alpha Studio", currency: "EUR" })
    .returning();
  [beta] = await db
    .insert(schema.business)
    .values({ name: "Beta Co", currency: "USD" })
    .returning();
  await db.insert(schema.businessMember).values([
    { businessId: alpha.id, userId: "owner-a", role: "owner" },
    { businessId: beta.id, userId: "owner-b", role: "owner" },
  ]);
});

afterAll(async () => {
  await pglite.close();
});

describe("team service (integration)", () => {
  it("invites, previews, and accepts - creating a membership", async () => {
    const result = await inviteMember(db, alpha.id, "owner-a", {
      email: "Newbie@Test.dev", // mixed case is normalised
      role: "member",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const token = result.invitation.token;
    expect(result.invitation.email).toBe("newbie@test.dev");

    const preview = await getInvitationPreview(db, token);
    expect(preview).toMatchObject({
      businessName: "Alpha Studio",
      role: "member",
      valid: true,
    });

    const accepted = await acceptInvitation(db, "newbie", token);
    expect(accepted).toMatchObject({ ok: true, businessId: alpha.id });

    const members = await listMembers(db, alpha.id);
    expect(members.map((m) => m.userId).sort()).toEqual(["newbie", "owner-a"]);

    // The invite is consumed; a second accept is rejected, not duplicated.
    const again = await acceptInvitation(db, "newbie", token);
    expect(again).toMatchObject({ ok: false, reason: "not_pending" });
    const memberRows = await db
      .select()
      .from(schema.businessMember)
      .where(
        and(
          eq(schema.businessMember.businessId, alpha.id),
          eq(schema.businessMember.userId, "newbie"),
        ),
      );
    expect(memberRows).toHaveLength(1);
  });

  it("rejects inviting an existing member or a duplicate email", async () => {
    expect(
      await inviteMember(db, alpha.id, "owner-a", { email: "owner-a@test.dev", role: "member" }),
    ).toMatchObject({ ok: false, reason: "already_member" });

    const first = await inviteMember(db, alpha.id, "owner-a", {
      email: "dupe@test.dev",
      role: "member",
    });
    expect(first.ok).toBe(true);
    expect(
      await inviteMember(db, alpha.id, "owner-a", { email: "dupe@test.dev", role: "member" }),
    ).toMatchObject({ ok: false, reason: "already_invited" });
  });

  it("revokes a pending invitation so it can no longer be accepted", async () => {
    const created = await inviteMember(db, alpha.id, "owner-a", {
      email: "revoked@test.dev",
      role: "member",
    });
    if (!created.ok) throw new Error("invite failed");
    const revoked = await revokeInvitation(db, alpha.id, created.invitation.id);
    expect(revoked?.status).toBe("revoked");

    const preview = await getInvitationPreview(db, created.invitation.token);
    expect(preview?.valid).toBe(false);
    expect(await acceptInvitation(db, "newbie", created.invitation.token)).toMatchObject({
      ok: false,
      reason: "not_pending",
    });
  });

  it("treats an expired invite as invalid", async () => {
    const [expired] = await db
      .insert(schema.businessInvitation)
      .values({
        businessId: alpha.id,
        email: "late@test.dev",
        role: "member",
        token: "expired-token-fixture",
        invitedByUserId: "owner-a",
        expiresAt: new Date(Date.now() - 1000),
      })
      .returning();
    const preview = await getInvitationPreview(db, expired.token);
    expect(preview?.valid).toBe(false);
    expect(await acceptInvitation(db, "second-owner", expired.token)).toMatchObject({
      ok: false,
      reason: "expired",
    });
  });

  it("removes members but never the last owner", async () => {
    // newbie joined alpha earlier; owner-a can remove them.
    expect(await removeMember(db, alpha.id, "newbie")).toEqual({ ok: true });
    expect(
      (await listMembers(db, alpha.id)).some((m) => m.userId === "newbie"),
    ).toBe(false);

    // owner-a is the only owner of alpha now - cannot be removed.
    expect(await removeMember(db, alpha.id, "owner-a")).toMatchObject({
      ok: false,
      reason: "last_owner",
    });

    // Add a second owner, then the first can leave.
    await db
      .insert(schema.businessMember)
      .values({ businessId: alpha.id, userId: "second-owner", role: "owner" });
    expect(await removeMember(db, alpha.id, "owner-a")).toEqual({ ok: true });
  });

  it("scopes mutations to the business (tenancy)", async () => {
    const created = await inviteMember(db, beta.id, "owner-b", {
      email: "x@test.dev",
      role: "member",
    });
    if (!created.ok) throw new Error("invite failed");
    // Alpha cannot revoke Beta's invitation, nor remove Beta's member.
    expect(await revokeInvitation(db, alpha.id, created.invitation.id)).toBeNull();
    expect(await removeMember(db, alpha.id, "owner-b")).toMatchObject({
      ok: false,
      reason: "not_member",
    });
    const betaPending = await listPendingInvitations(db, beta.id);
    expect(betaPending.some((i) => i.id === created.invitation.id)).toBe(true);
  });
});
