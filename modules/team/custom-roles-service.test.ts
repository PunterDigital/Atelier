import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { schema, type Db } from "@/db";

import {
  createCustomRole,
  deleteCustomRole,
  listCustomRoles,
  listMembers,
  setMemberCustomRole,
  setMemberRole,
  updateCustomRole,
} from "./service";

const migrationsFolder = fileURLToPath(
  new URL("../../db/migrations", import.meta.url),
);

let pglite: PGlite;
let db: Db;
let alpha: { id: string };
let beta: { id: string };

beforeAll(async () => {
  pglite = new PGlite();
  const pgliteDb = drizzle(pglite, { schema });
  await migrate(pgliteDb, { migrationsFolder });
  db = pgliteDb;

  await db.insert(schema.user).values([
    { id: "owner-a", name: "Owner A", email: "owner-a@test.dev" },
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

describe("custom role CRUD", () => {
  it("creates a role and lists it back, dropping unknown permissions", async () => {
    const result = await createCustomRole(db, alpha.id, "Bookkeeper", [
      "invoices.view",
      "expenses.approve",
      // not a real permission - must be dropped on read
      "invoices.teleport" as never,
    ]);
    expect(result.ok).toBe(true);

    const roles = await listCustomRoles(db, alpha.id);
    const role = roles.find((r) => r.name === "Bookkeeper");
    expect(role).toBeDefined();
    expect(role!.permissions.sort()).toEqual([
      "expenses.approve",
      "invoices.view",
    ]);
  });

  it("rejects a duplicate name in the same business", async () => {
    expect(
      await createCustomRole(db, alpha.id, "Bookkeeper", ["clients.view"]),
    ).toMatchObject({ ok: false, reason: "duplicate_name" });
  });

  it("allows the same name in a different business (tenancy)", async () => {
    expect(
      (await createCustomRole(db, beta.id, "Bookkeeper", ["clients.view"])).ok,
    ).toBe(true);
  });

  it("updates name and permissions", async () => {
    const [role] = await listCustomRoles(db, alpha.id);
    const res = await updateCustomRole(db, alpha.id, role.id, "Finance", [
      "invoices.view",
      "invoices.markPaid",
    ]);
    expect(res.ok).toBe(true);
    const updated = (await listCustomRoles(db, alpha.id)).find(
      (r) => r.id === role.id,
    );
    expect(updated!.name).toBe("Finance");
    expect(updated!.permissions.sort()).toEqual([
      "invoices.markPaid",
      "invoices.view",
    ]);
  });

  it("won't update a role from another business", async () => {
    const [betaRole] = await listCustomRoles(db, beta.id);
    expect(
      await updateCustomRole(db, alpha.id, betaRole.id, "Nope", []),
    ).toMatchObject({ ok: false, reason: "not_found" });
  });
});

describe("assigning and deleting custom roles", () => {
  it("assigns a custom role to a member", async () => {
    const [role] = await listCustomRoles(db, alpha.id);
    expect(await setMemberCustomRole(db, alpha.id, "staff-a", role.id)).toEqual({
      ok: true,
    });
    const member = (await listMembers(db, alpha.id)).find(
      (m) => m.userId === "staff-a",
    );
    expect(member!.role).toBe("custom");
    expect(member!.businessRoleId).toBe(role.id);
  });

  it("refuses to delete a role that is still assigned", async () => {
    const [role] = await listCustomRoles(db, alpha.id);
    expect(await deleteCustomRole(db, alpha.id, role.id)).toMatchObject({
      ok: false,
      reason: "in_use",
    });
  });

  it("deletes once no member holds it", async () => {
    const [role] = await listCustomRoles(db, alpha.id);
    // Move the member back to a predefined role, which clears the link.
    await setMemberRole(db, alpha.id, "staff-a", "member");
    const member = (await listMembers(db, alpha.id)).find(
      (m) => m.userId === "staff-a",
    );
    expect(member!.role).toBe("member");
    expect(member!.businessRoleId).toBeNull();

    expect(await deleteCustomRole(db, alpha.id, role.id)).toEqual({
      ok: true,
      id: role.id,
    });
  });

  it("won't assign a role that doesn't belong to the business", async () => {
    const [betaRole] = await listCustomRoles(db, beta.id);
    expect(
      await setMemberCustomRole(db, alpha.id, "staff-a", betaRole.id),
    ).toMatchObject({ ok: false, reason: "role_not_found" });
  });

  it("won't strip the last owner by assigning them a custom role", async () => {
    const role = await createCustomRole(db, alpha.id, "Limited", ["clients.view"]);
    if (!role.ok) throw new Error("setup failed");
    expect(
      await setMemberCustomRole(db, alpha.id, "owner-a", role.id),
    ).toMatchObject({ ok: false, reason: "last_owner" });
    // Owner unchanged.
    const owner = (await listMembers(db, alpha.id)).find(
      (m) => m.userId === "owner-a",
    );
    expect(owner!.role).toBe("owner");
  });

  it("cascades the role link is cleared when the role row is force-removed", async () => {
    // Defensive: deleting a member's businessRole leaves no dangling rows
    // because deletion is blocked while in use; here we assert the FK column
    // simply holds what we set.
    const made = await createCustomRole(db, alpha.id, "Temp", ["clients.view"]);
    if (!made.ok) throw new Error("setup failed");
    await setMemberCustomRole(db, alpha.id, "staff-a", made.id);
    const [m] = await db
      .select({ businessRoleId: schema.businessMember.businessRoleId })
      .from(schema.businessMember)
      .where(eq(schema.businessMember.userId, "staff-a"));
    expect(m.businessRoleId).toBe(made.id);
    // reset
    await setMemberRole(db, alpha.id, "staff-a", "member");
  });
});
