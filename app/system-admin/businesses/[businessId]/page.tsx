import { TRPCError } from "@trpc/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatDateTime, formatMinutes, formatMoney } from "@/lib/format";
import { caller } from "@/server/trpc/server";

import { SuspendBusinessControl } from "./suspend-business-control";

export const metadata: Metadata = {
  title: "Business - System Administration - Clerq",
};

export const dynamic = "force-dynamic";

async function loadBusiness(businessId: string) {
  try {
    return await caller.admin.getBusiness({ businessId });
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }
}

function currencyTotals(totals: { currency: string; totalMinor: number }[]) {
  if (totals.length === 0) return "Nothing yet";
  return totals.map((t) => formatMoney(t.totalMinor, t.currency)).join(", ");
}

export default async function SystemAdminBusinessDetailPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = await loadBusiness(businessId);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link
          href="/system-admin/businesses"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Businesses
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-2xl">{business.name}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Business</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <Row label="Currency" value={business.currency} />
          <Row label="Created" value={formatDate(business.createdAt)} />
          <Row
            label="Status"
            value={
              business.suspension
                ? `Suspended ${formatDateTime(business.suspension.suspendedAt)}${
                    business.suspension.reason ? ` - ${business.suspension.reason}` : ""
                  }`
                : "Active"
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Financials</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <Row
            label="Invoiced"
            value={`${currencyTotals(business.stats.invoicedTotals)} (${business.stats.invoiceCount} ${
              business.stats.invoiceCount === 1 ? "invoice" : "invoices"
            })`}
          />
          <Row
            label="Expenses"
            value={`${currencyTotals(business.stats.expenseTotals)} (${business.stats.expenseCount} ${
              business.stats.expenseCount === 1 ? "expense" : "expenses"
            })`}
          />
          <Row
            label="Time tracked"
            value={
              business.stats.timeTrackedSeconds > 0
                ? formatMinutes(Math.round(business.stats.timeTrackedSeconds / 60))
                : "0h"
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>
          {business.members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {business.members.map((m) => (
                <li key={m.userId} className="flex items-center justify-between text-sm">
                  <Link
                    href={`/system-admin/users/${m.userId}`}
                    className="min-w-0 truncate font-medium underline-offset-4 hover:underline"
                  >
                    {m.name}
                  </Link>
                  <span className="shrink-0 text-muted-foreground">{m.roleName}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Moderation</CardTitle>
        </CardHeader>
        <CardContent>
          <SuspendBusinessControl
            businessId={business.id}
            suspended={!!business.suspension}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium">{value}</span>
    </div>
  );
}
