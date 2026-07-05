import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { listCurrencyOptions } from "@/lib/currencies";
import { minorToMajor } from "@/modules/billing/currency";
import { caller } from "@/server/trpc/server";

import { ScheduleForm } from "../../schedule-form";

export const metadata: Metadata = {
  title: "Edit recurring invoice - Clerq",
};

export const dynamic = "force-dynamic";

// A UTC-midnight date back to the yyyy-mm-dd a <input type="date"> expects.
const toDateInput = (date: Date) => date.toISOString().slice(0, 10);

export default async function EditRecurringInvoicePage({
  params,
}: {
  params: Promise<{ scheduleId: string }>;
}) {
  const { scheduleId } = await params;

  const [schedule, clients, settings] = await Promise.all([
    caller.recurring.get({ scheduleId }).catch(() => null),
    caller.clients.list(),
    caller.business.settings(),
  ]);
  if (!schedule) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-2xl">Edit recurring invoice</h1>
      <ScheduleForm
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        defaultCurrency={settings.currency}
        currencyOptions={listCurrencyOptions()}
        standardRateConfigured={Boolean(settings.standardRatePct)}
        hasVatNumber={Boolean(settings.vatNumber)}
        initial={{
          id: schedule.id,
          name: schedule.name,
          clientId: schedule.clientId,
          currency: schedule.currency,
          taxTreatment: schedule.taxTreatment,
          frequency: schedule.frequency,
          interval: schedule.interval,
          startDate: toDateInput(schedule.startDate),
          netTermsDays: schedule.netTermsDays,
          endDate: schedule.endDate ? toDateInput(schedule.endDate) : null,
          occurrenceLimit: schedule.occurrenceLimit,
          autoIssue: schedule.autoIssue,
          notes: schedule.notes,
          lines: schedule.lines.map((line) => ({
            description: line.description,
            amountMajor: minorToMajor(line.amountMinor, schedule.currency),
          })),
        }}
      />
    </div>
  );
}
