import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { listCurrencyOptions } from "@/lib/currencies";
import { caller } from "@/server/trpc/server";

import { ScheduleForm } from "../schedule-form";

export const metadata: Metadata = {
  title: "New recurring invoice - Clerq",
};

export const dynamic = "force-dynamic";

export default async function NewRecurringInvoicePage() {
  const [clients, settings] = await Promise.all([
    caller.clients.list(),
    caller.business.settings(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-2xl">New recurring invoice</h1>
      {clients.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border bg-card p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Recurring invoices bill a client - add one first
          </p>
          <Button asChild>
            <Link href="/clients/new">Add a client</Link>
          </Button>
        </div>
      ) : (
        <ScheduleForm
          clients={clients.map((c) => ({ id: c.id, name: c.name }))}
          defaultCurrency={settings.currency}
          currencyOptions={listCurrencyOptions()}
          standardRateConfigured={Boolean(settings.standardRatePct)}
          hasVatNumber={Boolean(settings.vatNumber)}
        />
      )}
    </div>
  );
}
