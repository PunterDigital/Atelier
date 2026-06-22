import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { schema, type Db } from "@/db";
import { createClient } from "@/modules/clients/service";

import { createDraftInvoice, issueInvoice } from "./invoices";
import {
  getInvoice,
  listInvoices,
  markInvoicePaid,
  voidInvoice,
} from "./lifecycle";

const migrationsFolder = fileURLToPath(
  new URL("../../db/migrations", import.meta.url),
);

let pglite: PGlite;
let db: Db;
let businessA: { id: string };
let businessB: { id: string };
let clientA: { id: string };
let clientB: { id: string };

async function issuedInvoice(
  businessId: string,
  clientId: string,
  dueDate: Date,
) {
  const draft = await createDraftInvoice(db, businessId, {
    clientId,
    currency: "EUR",
    taxTreatment: "zero_rated",
    dueDate,
  });
  const result = await issueInvoice(
    db,
    businessId,
    (draft as { id: string }).id,
    new Date("2026-06-01T12:00:00Z"),
  );
  if (!result.ok) {
    throw new Error("test setup: issue failed");
  }
  return result.invoice;
}

beforeAll(async () => {
  pglite = new PGlite();
  const pgliteDb = drizzle(pglite, { schema });
  await migrate(pgliteDb, { migrationsFolder });
  db = pgliteDb;

  [businessA] = await db
    .insert(schema.business)
    .values({ name: "Alpha", currency: "EUR" })
    .returning();
  [businessB] = await db
    .insert(schema.business)
    .values({ name: "Beta", currency: "CZK" })
    .returning();
  await db
    .insert(schema.user)
    .values([{ id: "u1", name: "Ada", email: "ada@alpha.test" }]);
  clientA = await createClient(db, businessA.id, "u1", {
    name: "Client A",
    contacts: [],
  });
  clientB = await createClient(db, businessB.id, "u1", {
    name: "Client B",
    contacts: [],
  });
});

afterAll(async () => {
  await pglite.close();
});

describe("invoice lifecycle", () => {
  it("flips sent past-due invoices to overdue on read, scoped to the business", async () => {
    const pastDue = await issuedInvoice(
      businessA.id,
      clientA.id,
      new Date("2026-06-08T00:00:00Z"),
    );
    const notDue = await issuedInvoice(
      businessA.id,
      clientA.id,
      new Date("2026-07-15T00:00:00Z"),
    );
    const otherBusinessPastDue = await issuedInvoice(
      businessB.id,
      clientB.id,
      new Date("2026-06-08T00:00:00Z"),
    );

    const now = new Date("2026-06-11T09:00:00Z");
    const listed = await listInvoices(db, businessA.id, now);
    expect(listed.find((i) => i.id === pastDue.id)?.status).toBe("overdue");
    expect(listed.find((i) => i.id === notDue.id)?.status).toBe("sent");

    // The other business's invoice was not touched by A's read.
    const other = await getInvoice(
      db,
      businessB.id,
      otherBusinessPastDue.id,
      new Date("2026-06-05T00:00:00Z"),
    );
    expect(other?.status).toBe("sent");
  });

  it("marks sent and overdue invoices paid; drafts and foreign invoices never", async () => {
    const invoice = await issuedInvoice(
      businessA.id,
      clientA.id,
      new Date("2026-07-01T00:00:00Z"),
    );

    // Foreign business cannot pay it.
    expect(await markInvoicePaid(db, businessB.id, invoice.id)).toBeNull();

    const paid = await markInvoicePaid(db, businessA.id, invoice.id);
    expect(paid?.status).toBe("paid");
    // Terminal: paying again is a no-op null.
    expect(await markInvoicePaid(db, businessA.id, invoice.id)).toBeNull();

    // Overdue invoices can be paid.
    const late = await issuedInvoice(
      businessA.id,
      clientA.id,
      new Date("2026-06-02T00:00:00Z"),
    );
    await listInvoices(db, businessA.id, new Date("2026-06-11T00:00:00Z"));
    const latePaid = await markInvoicePaid(db, businessA.id, late.id);
    expect(latePaid?.status).toBe("paid");

    // Drafts cannot be paid.
    const draft = await createDraftInvoice(db, businessA.id, {
      clientId: clientA.id,
      currency: "EUR",
      taxTreatment: "zero_rated",
    });
    expect(
      await markInvoicePaid(db, businessA.id, (draft as { id: string }).id),
    ).toBeNull();
  });

  it("voids sent and overdue invoices, logs the reason, and is terminal", async () => {
    const invoice = await issuedInvoice(
      businessA.id,
      clientA.id,
      new Date("2026-07-20T00:00:00Z"),
    );

    // Foreign business cannot void it.
    expect(await voidInvoice(db, businessB.id, "u1", invoice.id)).toBeNull();

    const voided = await voidInvoice(
      db,
      businessA.id,
      "u1",
      invoice.id,
      "  client address changed  ",
    );
    expect(voided?.status).toBe("void");
    expect(voided?.voidedAt).toBeInstanceOf(Date);
    // The number is kept - a voided invoice stays in the sequence.
    expect(voided?.number).toBe(invoice.number);
    // The reason is trimmed and stored.
    expect(voided?.voidReason).toBe("client address changed");

    // The void is recorded on the client's activity thread.
    const events = await db
      .select()
      .from(schema.activity)
      .where(
        and(
          eq(schema.activity.clientId, clientA.id),
          eq(schema.activity.type, "invoice_voided"),
        ),
      );
    expect(events).toHaveLength(1);
    expect(events[0].payload).toMatchObject({
      number: invoice.number,
      reason: "client address changed",
    });

    // Terminal: voiding again is a no-op null.
    expect(await voidInvoice(db, businessA.id, "u1", invoice.id)).toBeNull();

    // Overdue invoices can be voided too.
    const late = await issuedInvoice(
      businessA.id,
      clientA.id,
      new Date("2026-06-03T00:00:00Z"),
    );
    await listInvoices(db, businessA.id, new Date("2026-06-11T00:00:00Z"));
    const lateVoid = await voidInvoice(db, businessA.id, "u1", late.id);
    expect(lateVoid?.status).toBe("void");
    expect(lateVoid?.voidReason).toBeNull();
  });

  it("never voids drafts or paid invoices", async () => {
    // Drafts are edited, not voided.
    const draft = await createDraftInvoice(db, businessA.id, {
      clientId: clientA.id,
      currency: "EUR",
      taxTreatment: "zero_rated",
    });
    expect(
      await voidInvoice(db, businessA.id, "u1", (draft as { id: string }).id),
    ).toBeNull();

    // Paid is terminal - it cannot be voided.
    const invoice = await issuedInvoice(
      businessA.id,
      clientA.id,
      new Date("2026-08-01T00:00:00Z"),
    );
    await markInvoicePaid(db, businessA.id, invoice.id);
    expect(await voidInvoice(db, businessA.id, "u1", invoice.id)).toBeNull();
  });
});
