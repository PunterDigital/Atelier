import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { InvoiceStatusPill, ScheduleStatusPill } from "@/components/status-pill";
import { formatDate, formatDateFull, formatMoney } from "@/lib/format";
import { caller } from "@/server/trpc/server";

import { cadenceLabel } from "../cadence";
import { ScheduleActions } from "./schedule-actions";

export const metadata: Metadata = {
  title: "Recurring invoice - Clerq",
};

export const dynamic = "force-dynamic";

const treatmentLabel: Record<string, string> = {
  standard: "Standard rate",
  zero_rated: "Zero-rated",
  reverse_charge: "EU reverse charge",
};

function endConditionLabel(schedule: {
  endDate: Date | null;
  occurrenceLimit: number | null;
}): string {
  const parts: string[] = [];
  if (schedule.endDate) parts.push(`on ${formatDateFull(schedule.endDate)}`);
  if (schedule.occurrenceLimit != null) {
    parts.push(`after ${schedule.occurrenceLimit} invoices`);
  }
  return parts.length ? parts.join(", ") : "Runs until paused or ended";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export default async function RecurringInvoiceDetailPage({
  params,
}: {
  params: Promise<{ scheduleId: string }>;
}) {
  const { scheduleId } = await params;

  const schedule = await caller.recurring.get({ scheduleId }).catch(() => null);
  if (!schedule) {
    notFound();
  }
  const invoices = await caller.recurring.generated({ scheduleId });
  const subtotal = schedule.lines.reduce((sum, l) => sum + l.amountMinor, 0);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <Link
          href="/invoices/recurring"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          &larr; Recurring invoices
        </Link>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl">{schedule.name}</h1>
            <ScheduleStatusPill status={schedule.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {cadenceLabel(schedule.frequency, schedule.interval)} &middot;{" "}
            {formatMoney(subtotal, schedule.currency)} per invoice
          </p>
        </div>
        <ScheduleActions scheduleId={schedule.id} status={schedule.status} />
      </div>

      {schedule.lastError ? (
        <div className="rounded-lg border border-[var(--status-overdue-fg)]/30 bg-[var(--status-overdue-bg)] px-4 py-3 text-sm text-[var(--status-overdue-fg)]">
          {schedule.lastError}
        </div>
      ) : null}

      <dl className="grid grid-cols-2 gap-4 rounded-lg border bg-card p-5 shadow-sm sm:grid-cols-3">
        <Field label="Client">{schedule.clientName}</Field>
        <Field label="Cadence">
          {cadenceLabel(schedule.frequency, schedule.interval)}
        </Field>
        <Field label={schedule.status === "active" ? "Next invoice" : "Next run"}>
          {schedule.status === "active" ? formatDate(schedule.nextRunAt) : "—"}
        </Field>
        <Field label="Payment terms">
          {schedule.netTermsDays === 0
            ? "Due on issue"
            : `Net ${schedule.netTermsDays} days`}
        </Field>
        <Field label="VAT treatment">
          {treatmentLabel[schedule.taxTreatment] ?? schedule.taxTreatment}
        </Field>
        <Field label="On generation">
          {schedule.autoIssue ? "Issued automatically" : "Saved as draft"}
        </Field>
        <Field label="Ends">{endConditionLabel(schedule)}</Field>
        <Field label="Generated so far">{schedule.generatedCount}</Field>
      </dl>

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="border-b px-4 py-2.5 text-sm font-medium">Lines</div>
        {schedule.lines.map((line) => (
          <div
            key={line.id}
            className="flex items-center gap-4 border-b px-4 py-2.5 last:border-b-0"
          >
            <span className="min-w-0 flex-1 truncate text-sm">
              {line.description}
            </span>
            <span className="shrink-0 text-sm font-medium tabular">
              {formatMoney(line.amountMinor, schedule.currency)}
            </span>
          </div>
        ))}
      </div>

      {schedule.notes ? (
        <p className="text-sm text-muted-foreground">{schedule.notes}</p>
      ) : null}

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Generated invoices</h2>
        {invoices.length === 0 ? (
          <div className="rounded-lg border bg-card px-8 py-10 text-center text-sm text-muted-foreground shadow-sm">
            None yet.{" "}
            {schedule.status === "active"
              ? `The first is due ${formatDate(schedule.nextRunAt)}.`
              : "This schedule isn't active."}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
            {invoices.map((invoice) => (
              <Link
                key={invoice.id}
                href={`/invoices/${invoice.id}`}
                className="flex items-center gap-4 border-b px-4 py-[13px] transition-colors last:border-b-0 hover:bg-muted"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium tabular">
                      {invoice.number ?? "Draft"}
                    </span>
                    <InvoiceStatusPill status={invoice.status} />
                  </div>
                  {invoice.issueDate ? (
                    <div className="text-sm text-muted-foreground">
                      {formatDate(invoice.issueDate)}
                    </div>
                  ) : null}
                </div>
                <span className="shrink-0 text-sm font-medium tabular">
                  {formatMoney(invoice.totalMinor, invoice.currency)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
