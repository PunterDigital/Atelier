import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { schema, type Db } from "@/db";

import {
  createExpense,
  deleteExpense,
  getExpense,
  listExpenses,
  setExpenseStatus,
  updateExpense,
} from "./service";

const migrationsFolder = fileURLToPath(
  new URL("../../db/migrations", import.meta.url),
);

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/1aHAAAAAElFTkSuQmCC";

let pglite: PGlite;
let db: Db;
let business: { id: string };
let other: { id: string };

beforeAll(async () => {
  pglite = new PGlite();
  const pgliteDb = drizzle(pglite, { schema });
  await migrate(pgliteDb, { migrationsFolder });
  db = pgliteDb;

  [business] = await db
    .insert(schema.business)
    .values({ name: "Alpha Studio", currency: "EUR" })
    .returning();
  [other] = await db
    .insert(schema.business)
    .values({ name: "Beta Co", currency: "USD" })
    .returning();
});

afterAll(async () => {
  await pglite.close();
});

describe("expenses service (integration)", () => {
  it("creates an expense, defaulting status to unpaid", async () => {
    const created = await createExpense(db, business.id, {
      description: "Adobe subscription",
      amountMinor: 4999,
      currency: "EUR",
      vendor: "Adobe",
      category: "Software",
      incurredAt: new Date("2026-06-01T00:00:00Z"),
    });
    expect(created.status).toBe("unpaid");
    expect(created.amountMinor).toBe(4999);
    expect(created.paidAt).toBeNull();
  });

  it("stores a receipt and excludes its data URL from list but not get", async () => {
    const created = await createExpense(db, business.id, {
      description: "Train ticket",
      amountMinor: 3250,
      currency: "EUR",
      incurredAt: new Date("2026-06-02T00:00:00Z"),
      receipt: { dataUrl: PNG, filename: "ticket.png", mimeType: "image/png" },
    });

    const fetched = await getExpense(db, business.id, created.id);
    expect(fetched?.receiptDataUrl).toBe(PNG);
    expect(fetched?.receiptFilename).toBe("ticket.png");

    const list = await listExpenses(db, business.id);
    const row = list.find((e) => e.id === created.id)!;
    // The list row carries the filename but not the (heavy) bytes.
    expect(row.receiptFilename).toBe("ticket.png");
    expect("receiptDataUrl" in row).toBe(false);
  });

  it("marks paid (stamping paid_at) and back to unpaid (clearing it)", async () => {
    const created = await createExpense(db, business.id, {
      description: "Hosting",
      amountMinor: 1200,
      currency: "EUR",
      incurredAt: new Date("2026-06-03T00:00:00Z"),
    });

    const paid = await setExpenseStatus(db, business.id, created.id, "paid");
    expect(paid?.status).toBe("paid");
    expect(paid?.paidAt).toBeInstanceOf(Date);

    const unpaid = await setExpenseStatus(db, business.id, created.id, "unpaid");
    expect(unpaid?.status).toBe("unpaid");
    expect(unpaid?.paidAt).toBeNull();
  });

  it("keeps the receipt when update omits it, and clears it when null", async () => {
    const created = await createExpense(db, business.id, {
      description: "Camera",
      amountMinor: 90000,
      currency: "EUR",
      incurredAt: new Date("2026-06-04T00:00:00Z"),
      receipt: { dataUrl: PNG, filename: "camera.png", mimeType: "image/png" },
    });

    // Omitting receipt leaves the stored one untouched.
    const renamed = await updateExpense(db, business.id, created.id, {
      description: "Camera body",
      amountMinor: 90000,
      currency: "EUR",
      incurredAt: new Date("2026-06-04T00:00:00Z"),
    });
    expect(renamed?.description).toBe("Camera body");
    expect(renamed?.receiptDataUrl).toBe(PNG);

    // Passing null clears it.
    const cleared = await updateExpense(db, business.id, created.id, {
      description: "Camera body",
      amountMinor: 90000,
      currency: "EUR",
      incurredAt: new Date("2026-06-04T00:00:00Z"),
      receipt: null,
    });
    expect(cleared?.receiptDataUrl).toBeNull();
    expect(cleared?.receiptFilename).toBeNull();
  });

  it("filters by status", async () => {
    const unpaidOnly = await listExpenses(db, business.id, { status: "unpaid" });
    expect(unpaidOnly.every((e) => e.status === "unpaid")).toBe(true);
    const paidOnly = await listExpenses(db, business.id, { status: "paid" });
    expect(paidOnly.every((e) => e.status === "paid")).toBe(true);
  });

  it("isolates expenses by business", async () => {
    const mine = await createExpense(db, business.id, {
      description: "Private",
      amountMinor: 500,
      currency: "EUR",
      incurredAt: new Date("2026-06-05T00:00:00Z"),
    });

    // Another business can neither read nor mutate it.
    expect(await getExpense(db, other.id, mine.id)).toBeNull();
    expect(await setExpenseStatus(db, other.id, mine.id, "paid")).toBeNull();
    expect(await deleteExpense(db, other.id, mine.id)).toBeNull();

    const otherList = await listExpenses(db, other.id);
    expect(otherList.find((e) => e.id === mine.id)).toBeUndefined();
  });

  it("deletes an expense", async () => {
    const created = await createExpense(db, business.id, {
      description: "One-off",
      amountMinor: 100,
      currency: "EUR",
      incurredAt: new Date("2026-06-06T00:00:00Z"),
    });
    const deleted = await deleteExpense(db, business.id, created.id);
    expect(deleted?.id).toBe(created.id);
    expect(await getExpense(db, business.id, created.id)).toBeNull();
  });
});
