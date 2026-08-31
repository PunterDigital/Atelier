import { PGlite } from "@electric-sql/pglite";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { schema, type Db } from "@/db";
import { resolveEffectivePermissions } from "@/modules/authz";
import { createTestDatabase } from "@/db/testing";

import {
  listMemberOverrides,
  listMembers,
  setMemberPermission,
  setMemberRole,
} from "./service";

let pglite: PGlite;
let db: Db;
let alpha: { id: string };
let beta: { id: string };

beforeAll(async () => {
  ({ pglite, db } = await createTestDatabase());

  await db.insert(schema.user).values([
    { id: "owner-a", name: "Owner A", email: "owner-a@test.dev" },
    { id: "owner-a2", name: "Owner A2", email: "owner-a2@test.dev" },
    { id: "staff-a", name: "Staff A", email: "staff-a@test.dev" },
    { id: "owner-b", name: "Owner B", email: "owner-b@test.dev" },
  ]);
  [alpha] = await db
    .insert(schema.business)
    .values({ name: "Alpha", currency: "EUR" })
    .returning();
  [beta] = await db
    .insert(schema.business)
    .values({ name: "Beta", currency: "USD" })
    .returning();
  await db.insert(schema.businessMember).values([
    { businessId: alpha.id, userId: "owner-a", role: "owner" },
    { businessId: alpha.id, userId: "staff-a", role: "member" },
    { businessId: beta.id, userId: "owner-b", role: "owner" },
  ]);
});

afterAll(async () => {
  await pglite.close();
});

describe("setMemberRole", () => {
  it("changes a member's role", async () => {
    expect(await setMemberRole(db, alpha.id, "staff-a", "manager")).toEqual({
      ok: true,
    });
    const members = await listMembers(db, alpha.id);
    expect(members.find((m) => m.userId === "staff-a")?.role).toBe("manager");
    // Reset for later tests.
    await setMemberRole(db, alpha.id, "staff-a", "member");
  });

  it("refuses to demote the last owner", async () => {
    expect(await setMemberRole(db, alpha.id, "owner-a", "member")).toMatchObject(
      { ok: false, reason: "last_owner" },
    );
    // The role is unchanged.
    const members = await listMembers(db, alpha.id);
    expect(members.find((m) => m.userId === "owner-a")?.role).toBe("owner");
  });

  it("allows demoting an owner once a second owner exists", async () => {
    await db
      .insert(schema.businessMember)
      .values({ businessId: alpha.id, userId: "owner-a2", role: "owner" });
    expect(await setMemberRole(db, alpha.id, "owner-a", "admin")).toEqual({
      ok: true,
    });
    // Put the founder back as owner.
    await setMemberRole(db, alpha.id, "owner-a", "owner");
  });

  it("is scoped to the business", async () => {
    expect(await setMemberRole(db, beta.id, "staff-a", "admin")).toMatchObject({
      ok: false,
      reason: "not_member",
    });
  });
});

describe("setMemberPermission", () => {
  it("upserts a grant, then resolves into the effective set", async () => {
    expect(
      await setMemberPermission(db, alpha.id, "staff-a", "settings.edit", "grant"),
    ).toEqual({ ok: true });

    const overrides = (await listMemberOverrides(db, alpha.id)).filter(
      (o) => o.permission === "settings.edit",
    );
    expect(overrides).toHaveLength(1);
    expect(overrides[0].effect).toBe("grant");

    const effective = resolveEffectivePermissions("member", [
      { permission: "settings.edit", effect: "grant" },
    ]);
    expect(effective.has("settings.edit")).toBe(true);
  });

  it("replaces an existing override rather than duplicating it", async () => {
    await setMemberPermission(db, alpha.id, "staff-a", "settings.edit", "deny");
    const overrides = (await listMemberOverrides(db, alpha.id)).filter(
      (o) => o.permission === "settings.edit",
    );
    expect(overrides).toHaveLength(1);
    expect(overrides[0].effect).toBe("deny");
  });

  it("clears an override when the effect is null", async () => {
    await setMemberPermission(db, alpha.id, "staff-a", "settings.edit", null);
    const overrides = (await listMemberOverrides(db, alpha.id)).filter(
      (o) => o.permission === "settings.edit",
    );
    expect(overrides).toHaveLength(0);
  });

  it("rejects a member of another business", async () => {
    expect(
      await setMemberPermission(db, beta.id, "staff-a", "clients.view", "deny"),
    ).toMatchObject({ ok: false, reason: "not_member" });
  });

  it("cascades override deletion when the membership is removed", async () => {
    await setMemberPermission(db, alpha.id, "staff-a", "clients.archive", "deny");
    const [member] = await db
      .select({ id: schema.businessMember.id })
      .from(schema.businessMember)
      .where(
        and(
          eq(schema.businessMember.businessId, alpha.id),
          eq(schema.businessMember.userId, "staff-a"),
        ),
      );
    await db
      .delete(schema.businessMember)
      .where(eq(schema.businessMember.id, member.id));
    const remaining = await db
      .select()
      .from(schema.businessMemberPermission)
      .where(eq(schema.businessMemberPermission.businessMemberId, member.id));
    expect(remaining).toHaveLength(0);
  });
});
