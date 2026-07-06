import { Repeat } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ScheduleStatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/lib/format";
import { caller } from "@/server/trpc/server";

import { InvoiceTabs } from "../invoice-tabs";
import { cadenceLabel } from "./cadence";

export const metadata: Metadata = {
  title: "Recurring invoices - Clerq",
};

export const dynamic = "force-dynamic";

export default async function RecurringInvoicesPage() {
  const schedules = await caller.recurring.list();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <h1 className="flex-1 text-2xl">Invoices</h1>
        <Button asChild>
          <Link href="/invoices/recurring/new">New recurring invoice</Link>
        </Button>
      </div>

      <InvoiceTabs />

      {schedules.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-lg border bg-card px-8 py-12 text-center shadow-sm">
          <span className="mb-2.5 flex size-12 items-center justify-center rounded-full bg-[var(--primary-subtle)] text-[var(--primary-subtle-fg)]">
            <Repeat className="size-[26px]" aria-hidden />
          </span>
          <h2 className="text-lg font-semibold">No recurring invoices yet</h2>
          <p className="max-w-[42ch] text-sm text-muted-foreground">
            Set up a retainer once and Clerq will draft each invoice for you when
            it comes due - ready to review and send.
          </p>
          <div className="mt-3.5">
            <Button asChild>
              <Link href="/invoices/recurring/new">
                Create a recurring invoice
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
          {schedules.map((schedule) => (
            <Link
              key={schedule.id}
              href={`/invoices/recurring/${schedule.id}`}
              className="flex items-center gap-4 border-b px-4 py-[13px] transition-colors last:border-b-0 hover:bg-muted"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {schedule.name}
                  </span>
                  <ScheduleStatusPill status={schedule.status} />
                  {schedule.lastError ? (
                    <span
                      className="rounded-full bg-[var(--status-overdue-bg)] px-2 py-px text-xs font-medium text-[var(--status-overdue-fg)]"
                      title={schedule.lastError}
                    >
                      Needs attention
                    </span>
                  ) : null}
                </div>
                <div className="truncate text-sm text-muted-foreground">
                  {schedule.clientName} &middot;{" "}
                  {cadenceLabel(schedule.frequency, schedule.interval)}
                  {schedule.status === "active"
                    ? ` · Next ${formatDate(schedule.nextRunAt)}`
                    : ""}
                </div>
              </div>
              <span className="shrink-0 text-sm font-medium tabular">
                {formatMoney(schedule.subtotalMinor, schedule.currency)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
