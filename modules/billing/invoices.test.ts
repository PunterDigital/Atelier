import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { schema, type Db } from "@/db";
import { createClient } from "@/modules/clients/service";

import {
  configureNextInvoiceNumber,
  createDraftInvoice,
  formatInvoiceNumber,
  issueInvoice,
} from "./invoices";

const fixture = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        "../../fixtures/billing/cases/invoice-numbering.json",
        import.meta.url,
      ),
    ),
    "utf8",
  ),
) as {
  expected: {
    format: { year: number; n: number; number: string }[];
    sequence: {
      businessA2026: string[];
      businessA2027FirstNumber: string;
      businessB2026FirstNumber: string;
    };
    configuredStart: {
      nextNumber: number;
      firstIssued: string;
      thenRejectsConfiguring: number;
    };
  };
};

const migrationsFolder = fileURLToPath(
  new URL("../../db/migrations", import.meta.url),
);

let pglite: PGlite;
let db: Db;
let businessA: { id: string };
let businessB: { id: string };
let businessC: { id: string };
let clientA: { id: string };
let clientB: { id: string };
let clientC: { id: string };
const userA = "user-a";

async function draft(businessId: string, clientId: string) {
  // zero_rated: numbering tests should not trip the reverse-charge
  // VAT-number requirement (tested explicitly below).
  const created = await createDraftInvoice(db, businessId, {
    clientId,
    currency: "EUR",
    taxTreatment: "zero_rated",
  });
  expect(created).not.toBeNull();
  return created as { id: string };
}

// Unwraps IssueResult so expectations read like before: the issued
// invoice, or null on any refusal.
async function issueOk(businessId: string, invoiceId: string, date?: Date) {
  const result = await issueInvoice(db, businessId, invoiceId, date);
  return result.ok ? result.invoice : null;
}

beforeAll(async () => {
  pglite = new PGlite();
  const pgliteDb = drizzle(pglite, { schema });
  await migrate(pgliteDb, { migrationsFolder });
  db = pgliteDb;

  [businessA] = await db
    .insert(schema.business)
    .values({ name: "Alpha Studio", currency: "GBP" })
    .returning();
  [businessB] = await db
    .insert(schema.business)
    .values({ name: "Beta Works", currency: "CZK" })
    .returning();
  [businessC] = await db
    .insert(schema.business)
    .values({ name: "Gamma Mill", currency: "EUR" })
    .returning();
  await db
    .insert(schema.user)
    .values([{ id: userA, name: "Ada", email: "ada@alpha.test" }]);
  clientA = await createClient(db, businessA.id, userA, {
    name: "Alpha client",
    contacts: [],
  });
  clientB = await createClient(db, businessB.id, userA, {
    name: "Beta client",
    contacts: [],
  });
  clientC = await createClient(db, businessC.id, userA, {
    name: "Gamma client",
    contacts: [],
  });
});

afterAll(async () => {
  await pglite.close();
});

describe("invoice number format (fixture: invoice-numbering.json)", () => {
  it("formats YYYY-NNNN zero-padded to four digits", () => {
    for (const c of fixture.expected.format) {
      expect(formatInvoiceNumber(c.year, c.n)).toBe(c.number);
    }
  });
});

describe("invoice numbering sequence", () => {
  it("issues sequentially per business per year, resetting each year", async () => {
    const seq = fixture.expected.sequence;

    const first = await issueOk(
      businessA.id,
      (await draft(businessA.id, clientA.id)).id,
      new Date("2026-06-10T12:00:00Z"),
    );
    const second = await issueOk(
      businessA.id,
      (await draft(businessA.id, clientA.id)).id,
      new Date("2026-07-01T12:00:00Z"),
    );
    expect([first?.number, second?.number]).toEqual(seq.businessA2026);
    expect(first?.status).toBe("sent");
    expect(first?.issueDate).toEqual(new Date("2026-06-10T12:00:00Z"));

    // New calendar year restarts at 0001.
    const nextYear = await issueOk(
      businessA.id,
      (await draft(businessA.id, clientA.id)).id,
      new Date("2027-01-02T09:00:00Z"),
    );
    expect(nextYear?.number).toBe(seq.businessA2027FirstNumber);

    // Another business has its own independent sequence.
    const otherBusiness = await issueOk(
      businessB.id,
      (await draft(businessB.id, clientB.id)).id,
      new Date("2026-08-15T12:00:00Z"),
    );
    expect(otherBusiness?.number).toBe(seq.businessB2026FirstNumber);
  });

  it("only drafts can be issued, and only by their own business", async () => {
    const target = await draft(businessB.id, clientB.id);
    // Wrong business: behaves like a missing record.
    expect(await issueOk(businessA.id, target.id)).toBeNull();

    const issued = await issueOk(
      businessB.id,
      target.id,
      new Date("2026-09-01T12:00:00Z"),
    );
    expect(issued).not.toBeNull();
    // Re-issuing an already-sent invoice is refused - its number is final.
    expect(await issueOk(businessB.id, target.id)).toBeNull();
  });

  it("refuses drafts linking another business's client", async () => {
    expect(
      await createDraftInvoice(db, businessA.id, {
        clientId: clientB.id,
        currency: "EUR",
        taxTreatment: "zero_rated",
      }),
    ).toBeNull();
  });
});

describe("configurable sequence start (spec Section 6 feedback)", () => {
  it("continues a migrated numbering and refuses collisions", async () => {
    const cfg = fixture.expected.configuredStart;

    const set = await configureNextInvoiceNumber(
      db,
      businessC.id,
      2026,
      cfg.nextNumber,
    );
    expect(set.ok).toBe(true);

    const issued = await issueOk(
      businessC.id,
      (await draft(businessC.id, clientC.id)).id,
      new Date("2026-06-11T12:00:00Z"),
    );
    expect(issued?.number).toBe(cfg.firstIssued);

    // Lowering below an issued number must be refused.
    const lowered = await configureNextInvoiceNumber(
      db,
      businessC.id,
      2026,
      cfg.thenRejectsConfiguring,
    );
    expect(lowered.ok).toBe(false);

    // Raising above the issued max is allowed.
    const raised = await configureNextInvoiceNumber(db, businessC.id, 2026, 200);
    expect(raised.ok).toBe(true);
  });

  it("rejects out-of-range numbers", async () => {
    expect((await configureNextInvoiceNumber(db, businessC.id, 2026, 0)).ok).toBe(
      false,
    );
    expect(
      (await configureNextInvoiceNumber(db, businessC.id, 2026, 10000)).ok,
    ).toBe(false);
  });
});

describe("reverse-charge VAT number requirement (spec Section 4)", () => {
  it("refuses to issue until both parties' VAT numbers exist", async () => {
    const created = await createDraftInvoice(db, businessA.id, {
      clientId: clientA.id,
      currency: "EUR",
      taxTreatment: "reverse_charge",
    });
    const invoiceId = (created as { id: string }).id;

    // Neither side has a VAT number yet.
    let result = await issueInvoice(db, businessA.id, invoiceId);
    expect(result).toMatchObject({
      ok: false,
      reason: "missing_vat_numbers",
      missing: ["business", "client"],
    });

    // Business VAT number alone is not enough.
    await db
      .update(schema.business)
      .set({ taxConfig: { vatNumber: "GB123456789" } })
      .where(eq(schema.business.id, businessA.id));
    result = await issueInvoice(db, businessA.id, invoiceId);
    expect(result).toMatchObject({
      ok: false,
      reason: "missing_vat_numbers",
      missing: ["client"],
    });

    // With both present the invoice issues normally.
    await db
      .update(schema.client)
      .set({ vatNumber: "CZ12345678" })
      .where(eq(schema.client.id, clientA.id));
    result = await issueInvoice(db, businessA.id, invoiceId);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.invoice.number).toBeTruthy();
    }
  });
});
