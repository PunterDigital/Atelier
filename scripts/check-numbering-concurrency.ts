/* Concurrency proof for invoice numbering (billing spec Section 6):
   issues N drafts in parallel over a real connection pool and asserts
   the allocated numbers are exactly 0001..000N - no gaps, no duplicates.
   Runs in CI against the Postgres service (see .github/workflows/ci.yml)
   and locally with: pnpm exec tsx --env-file-if-exists=.env scripts/check-numbering-concurrency.ts */

import { getDb, schema } from "@/db";
import { createDraftInvoice, issueInvoice } from "@/modules/billing/invoices";

const PARALLEL = 10;

async function main() {
  const db = getDb();

  const [business] = await db
    .insert(schema.business)
    .values({ name: `Concurrency Check ${process.pid}`, currency: "EUR" })
    .returning();
  const [client] = await db
    .insert(schema.client)
    .values({ businessId: business.id, name: "Race Client", contacts: [] })
    .returning();

  const drafts = [];
  for (let i = 0; i < PARALLEL; i++) {
    const draft = await createDraftInvoice(db, business.id, {
      clientId: client.id,
      currency: "EUR",
      taxTreatment: "reverse_charge",
    });
    if (!draft) {
      throw new Error("draft creation failed");
    }
    drafts.push(draft);
  }

  const issueDate = new Date();
  const issued = await Promise.all(
    drafts.map((d) => issueInvoice(db, business.id, d.id, issueDate)),
  );

  const numbers = issued
    .map((inv) => inv?.number)
    .filter((n): n is string => Boolean(n))
    .sort();
  const year = issueDate.getUTCFullYear();
  const expected = Array.from(
    { length: PARALLEL },
    (_, i) => `${year}-${String(i + 1).padStart(4, "0")}`,
  );

  if (JSON.stringify(numbers) !== JSON.stringify(expected)) {
    console.error("Expected:", expected);
    console.error("Got:     ", numbers);
    throw new Error("numbering is not concurrency-safe");
  }
  console.log(
    `OK: ${PARALLEL} parallel issues allocated ${numbers[0]}..${numbers[numbers.length - 1]} with no gaps or duplicates`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Concurrency check failed:", error);
    process.exit(1);
  });
