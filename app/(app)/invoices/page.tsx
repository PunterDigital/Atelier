import { ReceiptText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { InvoiceStatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/lib/format";
import { caller } from "@/server/trpc/server";

export const metadata: Metadata = {
  title: "Invoices - Atelier",
};

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const invoices = await caller.invoices.list();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <h1 className="flex-1 text-2xl">Invoices</h1>
        <Button asChild>
          <Link href="/invoices/new">New invoice</Link>
        </Button>
      </div>

      {invoices.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-lg border bg-card px-8 py-12 text-center shadow-sm">
          <span className="mb-2.5 flex size-12 items-center justify-center rounded-full bg-[var(--primary-subtle)] text-[var(--primary-subtle-fg)]">
            <ReceiptText className="size-[26px]" aria-hidden />
          </span>
          <h2 className="text-lg font-semibold">No invoices yet</h2>
          <p className="max-w-[40ch] text-sm text-muted-foreground">
            Track some time, then turn it into your first invoice
          </p>
          <div className="mt-3.5">
            <Button asChild>
              <Link href="/invoices/new">Create an invoice</Link>
            </Button>
          </div>
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
                <div className="truncate text-sm text-muted-foreground">
                  {invoice.clientName}
                </div>
              </div>
              {invoice.dueDate ? (
                <span className="hidden shrink-0 text-sm text-muted-foreground sm:inline">
                  Due {formatDate(invoice.dueDate)}
                </span>
              ) : null}
              <span className="shrink-0 text-sm font-medium tabular">
                {formatMoney(invoice.totalMinor, invoice.currency)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
