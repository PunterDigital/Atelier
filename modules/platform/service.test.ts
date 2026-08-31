import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { schema, type Db } from "@/db";
import { createTestDatabase } from "@/db/testing";

import {
  getBusinessDetail,
  getBusinessSuspension,
  getPlatformStats,
  getUserDetail,
  getUserSuspension,
  grantPlatformAdmin,
  isPlatformAdmin,
  listBusinesses,
  listUsers,
  reactivateBusiness,
  reactivateUser,
  revokePlatformAdmin,
  suspendBusiness,
  suspendUser,
} from "./service";

let pglite: PGlite;
let db: Db;

beforeAll(async () => {
  ({ pglite, db } = await createTestDatabase());
});

afterAll(async () => {
  await pglite.close();
});

// Every test starts from a clean slate of platform-level rows so the
// last-admin invariant and pagination counts stay predictable.
beforeEach(async () => {
  // FK-safe order: children before the parents they reference.
  await db.delete(schema.invoice);
  await db.delete(schema.expense);
  await db.delete(schema.client);
  await db.delete(schema.businessMember);
  await db.delete(schema.platformAdmin);
  await db.delete(schema.userSuspension);
  await db.delete(schema.businessSuspension);
  await db.delete(schema.business);
  await db.delete(schema.user);

  await db.insert(schema.user).values([
    { id: "admin-a", name: "Admin A", email: "admin-a@test.dev" },
    { id: "admin-b", name: "Admin B", email: "admin-b@test.dev" },
    { id: "founder", name: "Founder", email: "founder@test.dev" },
    { id: "teammate", name: "Teammate", email: "teammate@test.dev" },
  ]);
  await db.insert(schema.platformAdmin).values({ userId: "admin-a" });
});

describe("platform admin membership", () => {
  it("grants and revokes, protecting the last admin", async () => {
    expect(await isPlatformAdmin(db, "admin-a")).toBe(true);
    expect(await isPlatformAdmin(db, "founder")).toBe(false);

    expect(await revokePlatformAdmin(db, "admin-a")).toMatchObject({
      ok: false,
      reason: "last_admin",
    });

    const granted = await grantPlatformAdmin(db, "founder", "admin-a");
    expect(granted).toMatchObject({ ok: true });
    expect(await grantPlatformAdmin(db, "founder", "admin-a")).toMatchObject({
      ok: false,
      reason: "already_admin",
    });

    const revoked = await revokePlatformAdmin(db, "admin-a");
    expect(revoked).toMatchObject({ ok: true });
    expect(await isPlatformAdmin(db, "admin-a")).toBe(false);
    expect(await isPlatformAdmin(db, "founder")).toBe(true);
  });
});

describe("user moderation", () => {
  it("suspends and reactivates a user, blocking self-suspension", async () => {
    expect(
      await suspendUser(db, "admin-a", "admin-a", "self"),
    ).toMatchObject({ ok: false, reason: "cannot_suspend_self" });

    const suspended = await suspendUser(db, "teammate", "admin-a", "abuse report");
    expect(suspended).toMatchObject({ ok: true });
    expect(await getUserSuspension(db, "teammate")).toMatchObject({
      reason: "abuse report",
    });

    const reactivated = await reactivateUser(db, "teammate");
    expect(reactivated).toMatchObject({ ok: true });
    expect(await getUserSuspension(db, "teammate")).toBeNull();
    expect(await reactivateUser(db, "teammate")).toMatchObject({
      ok: false,
      reason: "not_suspended",
    });
  });

  it("lists users with search, pagination and derived flags", async () => {
    await suspendUser(db, "teammate", "admin-a");
    const [biz] = await db
      .insert(schema.business)
      .values({ name: "Alpha Studio", currency: "EUR" })
      .returning();
    await db.insert(schema.businessMember).values({
      businessId: biz.id,
      userId: "founder",
      role: "owner",
    });

    const page = await listUsers(db, { page: 1, pageSize: 2 });
    expect(page.total).toBe(4);
    expect(page.items).toHaveLength(2);

    const searched = await listUsers(db, {
      search: "teammate",
      page: 1,
      pageSize: 20,
    });
    expect(searched.items.map((u) => u.id)).toEqual(["teammate"]);
    expect(searched.items[0]).toMatchObject({ suspended: true, businessCount: 0 });

    const founderPage = await listUsers(db, {
      search: "founder@test.dev",
      page: 1,
      pageSize: 20,
    });
    expect(founderPage.items[0]).toMatchObject({
      businessCount: 1,
      isPlatformAdmin: false,
    });
  });

  it("returns a full user detail with memberships and admin status", async () => {
    const [biz] = await db
      .insert(schema.business)
      .values({ name: "Alpha Studio", currency: "EUR" })
      .returning();
    await db.insert(schema.businessMember).values({
      businessId: biz.id,
      userId: "founder",
      role: "owner",
    });

    const detail = await getUserDetail(db, "founder");
    expect(detail).toMatchObject({
      id: "founder",
      isPlatformAdmin: false,
      suspension: null,
    });
    expect(detail?.businesses).toEqual([
      { businessId: biz.id, name: "Alpha Studio", role: "owner", roleName: "Owner" },
    ]);

    expect(await getUserDetail(db, "nobody")).toBeNull();
  });
});

describe("business moderation", () => {
  it("suspends and reactivates a business", async () => {
    const [biz] = await db
      .insert(schema.business)
      .values({ name: "Beta Co", currency: "USD" })
      .returning();

    expect(
      await suspendBusiness(db, "00000000-0000-0000-0000-000000000000", "admin-a"),
    ).toMatchObject({
      ok: false,
      reason: "not_found",
    });

    const suspended = await suspendBusiness(db, biz.id, "admin-a", "fraud review");
    expect(suspended).toMatchObject({ ok: true });
    expect(await getBusinessSuspension(db, biz.id)).toMatchObject({
      reason: "fraud review",
    });

    const reactivated = await reactivateBusiness(db, biz.id);
    expect(reactivated).toMatchObject({ ok: true });
    expect(await getBusinessSuspension(db, biz.id)).toBeNull();
  });

  it("lists businesses with search, pagination and member counts", async () => {
    const [alpha] = await db
      .insert(schema.business)
      .values({ name: "Alpha Studio", currency: "EUR" })
      .returning();
    const [beta] = await db
      .insert(schema.business)
      .values({ name: "Beta Co", currency: "USD" })
      .returning();
    await db.insert(schema.businessMember).values([
      { businessId: alpha.id, userId: "founder", role: "owner" },
      { businessId: alpha.id, userId: "teammate", role: "member" },
    ]);
    await suspendBusiness(db, beta.id, "admin-a");

    const page = await listBusinesses(db, { page: 1, pageSize: 20 });
    expect(page.total).toBe(2);
    const alphaRow = page.items.find((b) => b.id === alpha.id);
    const betaRow = page.items.find((b) => b.id === beta.id);
    expect(alphaRow).toMatchObject({ memberCount: 2, suspended: false });
    expect(betaRow).toMatchObject({ memberCount: 0, suspended: true });

    const searched = await listBusinesses(db, {
      search: "beta",
      page: 1,
      pageSize: 20,
    });
    expect(searched.items.map((b) => b.id)).toEqual([beta.id]);
  });

  it("returns a full business detail with members and financial stats", async () => {
    const [biz] = await db
      .insert(schema.business)
      .values({ name: "Alpha Studio", currency: "EUR" })
      .returning();
    await db.insert(schema.businessMember).values({
      businessId: biz.id,
      userId: "founder",
      role: "owner",
    });
    const [client] = await db
      .insert(schema.client)
      .values({ businessId: biz.id, name: "Client" })
      .returning();
    await db.insert(schema.invoice).values([
      {
        businessId: biz.id,
        clientId: client.id,
        status: "sent",
        currency: "EUR",
        taxTreatment: "standard",
        totalMinor: 10000,
      },
      {
        businessId: biz.id,
        clientId: client.id,
        status: "draft",
        currency: "EUR",
        taxTreatment: "standard",
        totalMinor: 500000,
      },
    ]);
    await db.insert(schema.expense).values({
      businessId: biz.id,
      description: "Hosting",
      amountMinor: 2500,
      currency: "EUR",
      incurredAt: new Date(),
    });

    const detail = await getBusinessDetail(db, biz.id);
    expect(detail?.members).toEqual([
      {
        userId: "founder",
        name: "Founder",
        email: "founder@test.dev",
        role: "owner",
        roleName: "Owner",
        joinedAt: detail?.members[0].joinedAt,
      },
    ]);
    // The draft invoice is excluded from the invoiced total.
    expect(detail?.stats).toMatchObject({
      invoiceCount: 2,
      invoicedTotals: [{ currency: "EUR", totalMinor: 10000 }],
      expenseCount: 1,
      expenseTotals: [{ currency: "EUR", totalMinor: 2500 }],
    });

    expect(await getBusinessDetail(db, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});

describe("platform stats", () => {
  it("aggregates counts and per-currency totals with no identifying data", async () => {
    const [biz] = await db
      .insert(schema.business)
      .values({ name: "Alpha Studio", currency: "EUR" })
      .returning();
    const [client] = await db
      .insert(schema.client)
      .values({ businessId: biz.id, name: "Client" })
      .returning();
    await db.insert(schema.invoice).values([
      {
        businessId: biz.id,
        clientId: client.id,
        status: "paid",
        currency: "EUR",
        taxTreatment: "standard",
        totalMinor: 15000,
      },
      {
        businessId: biz.id,
        clientId: client.id,
        status: "void",
        currency: "EUR",
        taxTreatment: "standard",
        totalMinor: 99999,
      },
    ]);
    await db.insert(schema.expense).values({
      businessId: biz.id,
      description: "Hosting",
      amountMinor: 1200,
      currency: "EUR",
      incurredAt: new Date(),
    });

    const stats = await getPlatformStats(db);
    expect(stats.userCount).toBe(4);
    expect(stats.businessCount).toBe(1);
    expect(stats.invoiceCount).toBe(2);
    expect(stats.invoicedTotals).toEqual([{ currency: "EUR", totalMinor: 15000 }]);
    expect(stats.expenseCount).toBe(1);
    expect(stats.expenseTotals).toEqual([{ currency: "EUR", totalMinor: 1200 }]);
    expect(JSON.stringify(stats)).not.toMatch(/@test\.dev|Studio|Client/);
  });
});
