// Invoice-from-time (billing spec Section 7 + ESC-5 resolution).
// The grouping core is a pure function over entry data so every money
// path is fixture-testable; the db wrapper links entries to the lines it
// creates and recomputes invoice totals in the same transaction.

import { and, eq, inArray, isNotNull, isNull, max } from "drizzle-orm";

import type { Db } from "@/db";
import { schema } from "@/db";

import { majorToMinor, minorToMajor } from "./currency";
import {
  convertMinor,
  lineTotalMinorFromSeconds,
  parseDecimal,
} from "./money";
import { invoiceTotals } from "./tax";

export type GroupingMode = "person_rate" | "task" | "single";

export type BillableEntry = {
  id: string;
  userId: string;
  userName: string;
  taskId: string;
  taskTitle: string;
  durationSeconds: number;
  rateMinor: number | null;
  rateCurrency: string | null;
};

export type FxRateInput = { rate: string; source: "ecb" | "manual" };

export type GeneratedLine = {
  description: string;
  // Display-only decimal hours (6dp); the authoritative quantity is the
  // exact seconds carried by the linked entries.
  quantity: string;
  unitPriceMinor: number;
  totalMinor: number;
  sourceCurrency: string | null;
  sourceTotalMinor: number | null;
  fxRate: string | null;
  fxSource: "ecb" | "manual" | null;
  entryIds: string[];
};

export type GroupingResult =
  | {
      ok: true;
      lines: GeneratedLine[];
      // Billable entries that could not be priced (no stored rate) - they
      // stay unbilled and the UI surfaces them; never silently dropped.
      unpricedEntryIds: string[];
    }
  | { ok: false; reason: "missing_fx_rates"; currencies: string[] }
  | { ok: false; reason: "mixed_rates_for_single_line" }
  | { ok: false; reason: "nothing_to_bill" };

function hoursDisplay(seconds: number): string {
  // 6 decimal places: enough that display x rate reproduces the exact
  // total after rounding for any duration under a year.
  const whole = Math.floor(seconds / 3600);
  const rem = seconds % 3600;
  const fraction = Math.round((rem / 3600) * 1e6);
  return `${whole}.${String(fraction).padStart(6, "0")}`;
}

function priceLine(
  totalSeconds: number,
  rateMinor: number,
  rateCurrency: string,
  invoiceCurrency: string,
  fxRates: Record<string, FxRateInput>,
): Omit<GeneratedLine, "description" | "entryIds"> {
  // Rounding point 1: the line total in the rate's own currency.
  const sourceTotal = lineTotalMinorFromSeconds(totalSeconds, rateMinor);
  if (rateCurrency === invoiceCurrency) {
    return {
      quantity: hoursDisplay(totalSeconds),
      unitPriceMinor: rateMinor,
      totalMinor: sourceTotal,
      sourceCurrency: null,
      sourceTotalMinor: null,
      fxRate: null,
      fxSource: null,
    };
  }
  // Rounding point 3: one conversion of the line total (ESC-5).
  const fx = fxRates[rateCurrency];
  const totalMinor = convertMinor(
    sourceTotal,
    fx.rate,
    rateCurrency,
    invoiceCurrency,
  );
  return {
    quantity: hoursDisplay(totalSeconds),
    // The converted unit price is informational; the total is what was
    // converted (converting the total once, not the rate, per the spec).
    unitPriceMinor: convertMinor(rateMinor, fx.rate, rateCurrency, invoiceCurrency),
    totalMinor,
    sourceCurrency: rateCurrency,
    sourceTotalMinor: sourceTotal,
    fxRate: fx.rate,
    fxSource: fx.source,
  };
}

export function groupTimeEntriesToLines(input: {
  entries: BillableEntry[];
  grouping: GroupingMode;
  invoiceCurrency: string;
  fxRates?: Record<string, FxRateInput>;
  includeTaskList?: boolean;
}): GroupingResult {
  const fxRates = input.fxRates ?? {};
  const priced = input.entries.filter(
    (e) => e.rateMinor !== null && e.rateCurrency !== null,
  );
  const unpricedEntryIds = input.entries
    .filter((e) => e.rateMinor === null || e.rateCurrency === null)
    .map((e) => e.id);

  if (priced.length === 0) {
    return { ok: false, reason: "nothing_to_bill" };
  }

  // Every foreign rate currency needs an FX rate before any math runs.
  const foreign = [
    ...new Set(
      priced
        .map((e) => e.rateCurrency as string)
        .filter((c) => c !== input.invoiceCurrency),
    ),
  ];
  const missing = foreign.filter((c) => !fxRates[c]);
  if (missing.length > 0) {
    return { ok: false, reason: "missing_fx_rates", currencies: missing };
  }

  // Validate FX rate strings up front - a malformed rate must fail loud
  // before anything is computed.
  for (const c of foreign) {
    parseDecimal(fxRates[c].rate);
  }

  type Group = { key: string; description: string; entries: BillableEntry[] };
  let groups: Group[];

  if (input.grouping === "single") {
    const rateKeys = new Set(
      priced.map((e) => `${e.rateMinor}:${e.rateCurrency}`),
    );
    if (rateKeys.size > 1) {
      // Spec: single line is only offered when all entries share one rate.
      return { ok: false, reason: "mixed_rates_for_single_line" };
    }
    groups = [{ key: "single", description: "Tracked time", entries: priced }];
  } else if (input.grouping === "task") {
    // Per task, sub-split when manual overrides created mixed rates
    // within one task (each line still has exactly one rate).
    const map = new Map<string, Group>();
    for (const e of priced) {
      const key = `${e.taskId}:${e.rateMinor}:${e.rateCurrency}`;
      const group = map.get(key) ?? {
        key,
        description: e.taskTitle,
        entries: [],
      };
      group.entries.push(e);
      map.set(key, group);
    }
    groups = [...map.values()];
  } else {
    // person_rate (Shay's preferred mode): one line per person + rate.
    const map = new Map<string, Group>();
    for (const e of priced) {
      const key = `${e.userId}:${e.rateMinor}:${e.rateCurrency}`;
      const rate = `${minorToMajor(e.rateMinor as number, e.rateCurrency as string)} ${e.rateCurrency}/h`;
      const group = map.get(key) ?? {
        key,
        description: `${e.userName} - ${rate}`,
        entries: [],
      };
      group.entries.push(e);
      map.set(key, group);
    }
    groups = [...map.values()];
  }

  const lines: GeneratedLine[] = groups.map((group) => {
    const totalSeconds = group.entries.reduce(
      (sum, e) => sum + e.durationSeconds,
      0,
    );
    const first = group.entries[0];
    const taskList = [
      ...new Set(group.entries.map((e) => e.taskTitle)),
    ].sort();
    const description =
      input.includeTaskList && input.grouping !== "task"
        ? `${group.description} (${taskList.join(", ")})`
        : group.description;
    return {
      description,
      entryIds: group.entries.map((e) => e.id),
      ...priceLine(
        totalSeconds,
        first.rateMinor as number,
        first.rateCurrency as string,
        input.invoiceCurrency,
        fxRates,
      ),
    };
  });

  return { ok: true, lines, unpricedEntryIds };
}

// Recomputes invoice totals from its current lines through the tax
// engine. Always called inside the same transaction as a line change.
export async function recomputeInvoiceTotals(
  db: Db,
  businessId: string,
  invoiceId: string,
) {
  const [inv] = await db
    .select()
    .from(schema.invoice)
    .where(
      and(
        eq(schema.invoice.businessId, businessId),
        eq(schema.invoice.id, invoiceId),
      ),
    );
  if (!inv) {
    return null;
  }
  const lines = await db
    .select({ totalMinor: schema.invoiceLine.totalMinor })
    .from(schema.invoiceLine)
    .where(eq(schema.invoiceLine.invoiceId, invoiceId));
  const totals = invoiceTotals({
    lineTotalsMinor: lines.map((l) => l.totalMinor),
    treatment: inv.taxTreatment,
    standardRatePercent:
      inv.taxTreatment === "standard" ? inv.taxRatePercent : undefined,
  });
  const [updated] = await db
    .update(schema.invoice)
    .set({
      subtotalMinor: totals.subtotalMinor,
      taxMinor: totals.taxMinor,
      totalMinor: totals.totalMinor,
      updatedAt: new Date(),
    })
    .where(eq(schema.invoice.id, invoiceId))
    .returning();
  return updated;
}

// Pulls the client's unbilled, billable, closed entries (optionally one
// project's), runs the grouping core, and writes lines + entry links +
// totals in one transaction onto an existing draft invoice.
export async function generateLinesFromUnbilledTime(
  db: Db,
  businessId: string,
  input: {
    invoiceId: string;
    projectId?: string;
    grouping: GroupingMode;
    fxRates?: Record<string, FxRateInput>;
    includeTaskList?: boolean;
  },
) {
  return db.transaction(async (tx) => {
    const [inv] = await tx
      .select()
      .from(schema.invoice)
      .where(
        and(
          eq(schema.invoice.businessId, businessId),
          eq(schema.invoice.id, input.invoiceId),
        ),
      )
      .for("update");
    if (!inv || inv.status !== "draft") {
      return { ok: false as const, reason: "no_draft" as const };
    }

    const scope = [
      eq(schema.timeEntry.businessId, businessId),
      eq(schema.project.clientId, inv.clientId),
      eq(schema.timeEntry.billable, true),
      isNull(schema.timeEntry.invoiceLineId),
      isNotNull(schema.timeEntry.endedAt),
    ];
    if (input.projectId) {
      scope.push(eq(schema.project.id, input.projectId));
    }
    const rows = await tx
      .select({
        id: schema.timeEntry.id,
        userId: schema.timeEntry.userId,
        userName: schema.user.name,
        taskId: schema.timeEntry.taskId,
        taskTitle: schema.task.title,
        durationSeconds: schema.timeEntry.durationSeconds,
        rateMinor: schema.timeEntry.rateMinor,
        rateCurrency: schema.timeEntry.rateCurrency,
      })
      .from(schema.timeEntry)
      .innerJoin(schema.task, eq(schema.timeEntry.taskId, schema.task.id))
      .innerJoin(schema.project, eq(schema.task.projectId, schema.project.id))
      .innerJoin(schema.user, eq(schema.timeEntry.userId, schema.user.id))
      .where(and(...scope));

    const result = groupTimeEntriesToLines({
      entries: rows.map((r) => ({
        ...r,
        durationSeconds: r.durationSeconds ?? 0,
      })),
      grouping: input.grouping,
      invoiceCurrency: inv.currency,
      fxRates: input.fxRates,
      includeTaskList: input.includeTaskList,
    });
    if (!result.ok) {
      return result;
    }

    const [{ maxPosition }] = await tx
      .select({ maxPosition: max(schema.invoiceLine.position) })
      .from(schema.invoiceLine)
      .where(eq(schema.invoiceLine.invoiceId, inv.id));

    let position = Number(maxPosition ?? 0);
    for (const line of result.lines) {
      position += 1;
      const [created] = await tx
        .insert(schema.invoiceLine)
        .values({
          businessId,
          invoiceId: inv.id,
          position,
          description: line.description,
          quantity: line.quantity,
          unitPriceMinor: line.unitPriceMinor,
          totalMinor: line.totalMinor,
          sourceCurrency: line.sourceCurrency,
          sourceTotalMinor: line.sourceTotalMinor,
          fxRate: line.fxRate,
          fxSource: line.fxSource,
        })
        .returning();
      await tx
        .update(schema.timeEntry)
        .set({ invoiceLineId: created.id, updatedAt: new Date() })
        .where(inArray(schema.timeEntry.id, line.entryIds));
    }

    await recomputeInvoiceTotals(tx, businessId, inv.id);
    return {
      ok: true as const,
      lineCount: result.lines.length,
      unpricedEntryIds: result.unpricedEntryIds,
    };
  });
}

// Manual fixed-amount line: invoices are dual-purpose, not only
// time-based. The amount arrives as a major-unit string in the invoice
// currency and is converted exactly (rejected, never rounded, when it has
// more decimals than the currency allows). No new rounding point: what
// the user typed is the line total.
export async function addManualLine(
  db: Db,
  businessId: string,
  input: { invoiceId: string; description: string; amountMajor: string },
) {
  return db.transaction(async (tx) => {
    const [inv] = await tx
      .select({
        id: schema.invoice.id,
        status: schema.invoice.status,
        currency: schema.invoice.currency,
      })
      .from(schema.invoice)
      .where(
        and(
          eq(schema.invoice.businessId, businessId),
          eq(schema.invoice.id, input.invoiceId),
        ),
      )
      .for("update");
    if (!inv || inv.status !== "draft") {
      return { ok: false as const, reason: "no_draft" as const };
    }

    const totalMinor = majorToMinor(input.amountMajor, inv.currency);
    if (totalMinor === null) {
      return { ok: false as const, reason: "bad_amount" as const };
    }

    const [{ maxPosition }] = await tx
      .select({ maxPosition: max(schema.invoiceLine.position) })
      .from(schema.invoiceLine)
      .where(eq(schema.invoiceLine.invoiceId, inv.id));

    await tx.insert(schema.invoiceLine).values({
      businessId,
      invoiceId: inv.id,
      position: Number(maxPosition ?? 0) + 1,
      description: input.description,
      quantity: null,
      unitPriceMinor: null,
      totalMinor,
    });

    const updated = await recomputeInvoiceTotals(tx, businessId, inv.id);
    return { ok: true as const, invoice: updated };
  });
}

// Free-text notes printed at the foot of the invoice, just above the footer.
// Draft-only, like every other invoice edit; an empty/whitespace value clears
// them. Returns the updated invoice, or null when there is no draft to edit.
export async function setInvoiceNotes(
  db: Db,
  businessId: string,
  invoiceId: string,
  notes: string,
) {
  const trimmed = notes.trim();
  const [updated] = await db
    .update(schema.invoice)
    .set({ notes: trimmed || null, updatedAt: new Date() })
    .where(
      and(
        eq(schema.invoice.businessId, businessId),
        eq(schema.invoice.id, invoiceId),
        eq(schema.invoice.status, "draft"),
      ),
    )
    .returning();
  return updated ?? null;
}

// Removing a draft line releases its entries back to the unbilled pool
// (the FK is ON DELETE SET NULL) and recomputes totals.
export async function deleteInvoiceLine(
  db: Db,
  businessId: string,
  lineId: string,
) {
  return db.transaction(async (tx) => {
    const [line] = await tx
      .select({
        id: schema.invoiceLine.id,
        invoiceId: schema.invoiceLine.invoiceId,
        status: schema.invoice.status,
      })
      .from(schema.invoiceLine)
      .innerJoin(
        schema.invoice,
        eq(schema.invoiceLine.invoiceId, schema.invoice.id),
      )
      .where(
        and(
          eq(schema.invoiceLine.businessId, businessId),
          eq(schema.invoiceLine.id, lineId),
        ),
      );
    if (!line || line.status !== "draft") {
      return null;
    }
    await tx.delete(schema.invoiceLine).where(eq(schema.invoiceLine.id, line.id));
    return recomputeInvoiceTotals(tx, businessId, line.invoiceId);
  });
}
