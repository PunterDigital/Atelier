import { TRPCError } from "@trpc/server";
import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { caller } from "@/server/trpc/server";

export const metadata: Metadata = {
  title: "Reports - Clerq",
};

export const dynamic = "force-dynamic";

type Bucket = {
  currency: string;
  incomeMinor: number;
  expenseMinor: number;
  labourMinor: number;
  profitMinor: number;
};

function BasisCard({
  title,
  caption,
  buckets,
}: {
  title: string;
  caption: string;
  buckets: Bucket[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{caption}</p>
      </CardHeader>
      <CardContent>
        {buckets.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing to report yet.</p>
        ) : (
          <div className="flex flex-col gap-6">
            {buckets.map((b) => (
              <div key={b.currency} className="flex flex-col gap-2">
                <div className="text-xs font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                  {b.currency}
                </div>
                <Row label="Income" minor={b.incomeMinor} currency={b.currency} />
                <Row
                  label="Expenses"
                  minor={-b.expenseMinor}
                  currency={b.currency}
                />
                <Row
                  label="Team cost"
                  minor={-b.labourMinor}
                  currency={b.currency}
                />
                <div className="mt-1 flex items-baseline justify-between border-t pt-2">
                  <span className="text-sm font-semibold">Profit</span>
                  <span
                    className={
                      b.profitMinor < 0
                        ? "text-sm font-semibold text-destructive"
                        : "text-sm font-semibold"
                    }
                  >
                    {formatMoney(b.profitMinor, b.currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  minor,
  currency,
}: {
  label: string;
  minor: number;
  currency: string;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm tabular-nums">{formatMoney(minor, currency)}</span>
    </div>
  );
}

export default async function ReportsPage() {
  let report: { cash: Bucket[]; accrual: Bucket[] } | null = null;
  try {
    report = await caller.reports.profit();
  } catch (error) {
    if (error instanceof TRPCError && error.code === "FORBIDDEN") {
      return (
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl">Reports</h1>
          <p className="text-sm text-muted-foreground">
            You don&apos;t have permission to view profit reports.
          </p>
        </div>
      );
    }
    throw error;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl">Profit</h1>
        <p className="text-muted-foreground">
          Income minus expenses minus what you pay your team. Figures are shown
          per currency and never converted between them.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <BasisCard
          title="Cash"
          caption="Money that has actually moved: paid invoices, paid expenses, and the cost of time billed on a paid invoice."
          buckets={report.cash}
        />
        <BasisCard
          title="Accrued"
          caption="Everything recognised: issued invoices, all recorded expenses, and the cost of all billed time."
          buckets={report.accrual}
        />
      </div>
    </div>
  );
}
