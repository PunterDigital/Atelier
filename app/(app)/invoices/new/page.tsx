import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { listCurrencyOptions } from "@/lib/currencies";
import { caller } from "@/server/trpc/server";

import { NewInvoiceForm } from "./new-invoice-form";

export const metadata: Metadata = {
  title: "New invoice - Clerq",
};

export const dynamic = "force-dynamic";

export default async function NewInvoicePage() {
  const [clients, settings] = await Promise.all([
    caller.clients.list(),
    caller.business.settings(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <h1 className="text-2xl">New invoice</h1>
      {clients.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border bg-card p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Invoices are sent to a client - add one first
          </p>
          <Button asChild>
            <Link href="/clients/new">Add a client</Link>
          </Button>
        </div>
      ) : (
        <NewInvoiceForm
          clients={clients.map((c) => ({ id: c.id, name: c.name }))}
          defaultCurrency={settings.currency}
          currencyOptions={listCurrencyOptions()}
          standardRateConfigured={Boolean(settings.standardRatePct)}
        />
      )}
    </div>
  );
}
