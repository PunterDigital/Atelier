// Budget burn-down: tracked value against an optional budget, at client,
// project and per-member level. Tracked value is the billable worth of work
// logged so far (Σ seconds x effective hourly rate), counted whether or not it
// has been invoiced yet - so the indicator warns before money is even billed.
// Tracking only, never enforcement: nothing here blocks logging time or
// issuing invoices (the product decision). Like the profit module, money never
// crosses currencies: tracked value is compared to the budget only within the
// budget's own currency, and any work logged in another currency is flagged
// rather than converted.

import { and, eq, isNotNull } from "drizzle-orm";

import type { Db } from "@/db";
import { schema } from "@/db";

import { lineTotalMinorFromSeconds } from "@/modules/billing/money";

// Below this fraction the budget is "ok"; at or above it but under 1 it is
// "near"; at or beyond the full budget it is "over".
const NEAR_THRESHOLD = 0.8;

export type BudgetState = "ok" | "near" | "over";

export type BudgetStatus = {
  budgetMinor: number;
  currency: string;
  spentMinor: number;
  pct: number;
  state: BudgetState;
  // Currencies of tracked work that don't match the budget currency. When
  // non-empty the spentMinor figure is only the matching-currency slice and
  // the UI should note the comparison is partial.
  currencyMismatch: string[];
};

type PricedEntry = {
  durationSeconds: number | null;
  rateMinor: number | null;
  rateCurrency: string | null;
};

// Sums tracked value per currency over priced, billable entries.
function spentByCurrency(entries: PricedEntry[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    if (entry.rateMinor == null || !entry.rateCurrency) continue;
    const value = lineTotalMinorFromSeconds(
      entry.durationSeconds ?? 0,
      entry.rateMinor,
    );
    totals.set(
      entry.rateCurrency,
      (totals.get(entry.rateCurrency) ?? 0) + value,
    );
  }
  return totals;
}

// Builds a status from a budget (amount + currency) and the per-currency spend.
// Returns null when no budget is set - there is nothing to burn down.
function statusFrom(
  budgetMinor: number | null,
  budgetCurrency: string | null,
  spent: Map<string, number>,
): BudgetStatus | null {
  if (budgetMinor == null || !budgetCurrency || budgetMinor <= 0) {
    return null;
  }
  const spentMinor = spent.get(budgetCurrency) ?? 0;
  const currencyMismatch = [...spent.keys()].filter(
    (c) => c !== budgetCurrency,
  );
  const pct = spentMinor / budgetMinor;
  const state: BudgetState =
    pct >= 1 ? "over" : pct >= NEAR_THRESHOLD ? "near" : "ok";
  return { budgetMinor, currency: budgetCurrency, spentMinor, pct, state, currencyMismatch };
}

async function clientEntries(db: Db, businessId: string, clientId: string) {
  return db
    .select({
      durationSeconds: schema.timeEntry.durationSeconds,
      rateMinor: schema.timeEntry.rateMinor,
      rateCurrency: schema.timeEntry.rateCurrency,
      userId: schema.timeEntry.userId,
    })
    .from(schema.timeEntry)
    .innerJoin(schema.task, eq(schema.timeEntry.taskId, schema.task.id))
    .innerJoin(schema.project, eq(schema.task.projectId, schema.project.id))
    .where(
      and(
        eq(schema.timeEntry.businessId, businessId),
        eq(schema.project.clientId, clientId),
        eq(schema.timeEntry.billable, true),
        isNotNull(schema.timeEntry.endedAt),
      ),
    );
}

export async function clientBudgetStatus(
  db: Db,
  businessId: string,
  clientId: string,
): Promise<BudgetStatus | null> {
  const [client] = await db
    .select({
      budgetMinor: schema.client.budgetMinor,
      budgetCurrency: schema.client.budgetCurrency,
    })
    .from(schema.client)
    .where(
      and(
        eq(schema.client.businessId, businessId),
        eq(schema.client.id, clientId),
      ),
    );
  if (!client) return null;
  const entries = await clientEntries(db, businessId, clientId);
  return statusFrom(client.budgetMinor, client.budgetCurrency, spentByCurrency(entries));
}

export async function projectBudgetStatus(
  db: Db,
  businessId: string,
  projectId: string,
): Promise<BudgetStatus | null> {
  const [project] = await db
    .select({
      budgetMinor: schema.project.budgetMinor,
      budgetCurrency: schema.project.budgetCurrency,
    })
    .from(schema.project)
    .where(
      and(
        eq(schema.project.businessId, businessId),
        eq(schema.project.id, projectId),
      ),
    );
  if (!project) return null;
  const entries = await db
    .select({
      durationSeconds: schema.timeEntry.durationSeconds,
      rateMinor: schema.timeEntry.rateMinor,
      rateCurrency: schema.timeEntry.rateCurrency,
    })
    .from(schema.timeEntry)
    .innerJoin(schema.task, eq(schema.timeEntry.taskId, schema.task.id))
    .where(
      and(
        eq(schema.timeEntry.businessId, businessId),
        eq(schema.task.projectId, projectId),
        eq(schema.timeEntry.billable, true),
        isNotNull(schema.timeEntry.endedAt),
      ),
    );
  return statusFrom(
    project.budgetMinor,
    project.budgetCurrency,
    spentByCurrency(entries),
  );
}

// Per-member budgets on a client, keyed by userId. Only members with a budget
// set get a status; the rest are omitted.
export async function memberBudgetStatuses(
  db: Db,
  businessId: string,
  clientId: string,
): Promise<Record<string, BudgetStatus>> {
  const rates = await db
    .select({
      userId: schema.clientMemberRate.userId,
      budgetMinor: schema.clientMemberRate.budgetMinor,
      budgetCurrency: schema.clientMemberRate.budgetCurrency,
    })
    .from(schema.clientMemberRate)
    .where(
      and(
        eq(schema.clientMemberRate.businessId, businessId),
        eq(schema.clientMemberRate.clientId, clientId),
      ),
    );
  const withBudget = rates.filter(
    (r) => r.budgetMinor != null && r.budgetCurrency,
  );
  if (withBudget.length === 0) return {};

  const entries = await clientEntries(db, businessId, clientId);
  const result: Record<string, BudgetStatus> = {};
  for (const rate of withBudget) {
    const theirs = entries.filter((e) => e.userId === rate.userId);
    const status = statusFrom(
      rate.budgetMinor,
      rate.budgetCurrency,
      spentByCurrency(theirs),
    );
    if (status) result[rate.userId] = status;
  }
  return result;
}
