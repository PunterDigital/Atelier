import { Building2, Clock, ReceiptText, Users, Wallet } from "lucide-react";
import type { Metadata } from "next";

import { formatMinutes, formatMoney } from "@/lib/format";
import { caller } from "@/server/trpc/server";

export const metadata: Metadata = {
  title: "System Administration - Clerq",
};

export const dynamic = "force-dynamic";

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-[var(--primary-subtle-fg)]">{icon}</span>
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="text-xl font-semibold tabular">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function currencyTotals(totals: { currency: string; totalMinor: number }[]) {
  if (totals.length === 0) return "Nothing yet";
  return (
    <span className="flex flex-col">
      {totals.map((t) => (
        <span key={t.currency}>{formatMoney(t.totalMinor, t.currency)}</span>
      ))}
    </span>
  );
}

export default async function SystemAdminOverviewPage() {
  const stats = await caller.admin.stats();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Aggregate figures across every business on this instance. Nothing
          here identifies a specific user or business - drill into Users or
          Businesses for that.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={<Users className="size-4" aria-hidden />}
          label="Users registered"
          value={stats.userCount}
          sub="Across the whole instance"
        />
        <StatCard
          icon={<Building2 className="size-4" aria-hidden />}
          label="Organisations"
          value={stats.businessCount}
          sub="Businesses created"
        />
        <StatCard
          icon={<Clock className="size-4" aria-hidden />}
          label="Time tracked"
          value={
            stats.timeTrackedSeconds > 0
              ? formatMinutes(Math.round(stats.timeTrackedSeconds / 60))
              : "0h"
          }
          sub="Aggregated across every business"
        />
        <StatCard
          icon={<ReceiptText className="size-4" aria-hidden />}
          label="Invoiced"
          value={currencyTotals(stats.invoicedTotals)}
          sub={`${stats.invoiceCount} ${stats.invoiceCount === 1 ? "invoice" : "invoices"} total (drafts and voids excluded from the total)`}
        />
        <StatCard
          icon={<Wallet className="size-4" aria-hidden />}
          label="Expenses"
          value={currencyTotals(stats.expenseTotals)}
          sub={`${stats.expenseCount} ${stats.expenseCount === 1 ? "expense" : "expenses"} recorded`}
        />
      </div>
    </div>
  );
}
