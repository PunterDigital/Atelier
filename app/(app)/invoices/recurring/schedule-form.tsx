"use client";

import { useMutation } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CurrencySelect } from "@/components/currency-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CurrencyOption } from "@/lib/currencies";
import { useTRPC } from "@/server/trpc/client";

const selectClassName =
  "h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40";

type Treatment = "standard" | "zero_rated" | "reverse_charge";
type Frequency = "weekly" | "monthly" | "quarterly" | "yearly";
type LineDraft = { description: string; amountMajor: string };

export type ScheduleFormInitial = {
  id: string;
  name: string;
  clientId: string;
  currency: string;
  taxTreatment: Treatment;
  frequency: Frequency;
  interval: number;
  startDate: string;
  netTermsDays: number;
  endDate: string | null;
  occurrenceLimit: number | null;
  autoIssue: boolean;
  notes: string | null;
  lines: LineDraft[];
};

export function ScheduleForm({
  clients,
  defaultCurrency,
  currencyOptions,
  standardRateConfigured,
  hasVatNumber,
  initial,
}: {
  clients: { id: string; name: string }[];
  defaultCurrency: string;
  currencyOptions: CurrencyOption[];
  standardRateConfigured: boolean;
  hasVatNumber: boolean;
  initial?: ScheduleFormInitial;
}) {
  const router = useRouter();
  const trpc = useTRPC();

  const [name, setName] = useState(initial?.name ?? "");
  const [clientId, setClientId] = useState(
    initial?.clientId ?? clients[0]?.id ?? "",
  );
  const [currency, setCurrency] = useState(initial?.currency ?? defaultCurrency);
  const [treatment, setTreatment] = useState<Treatment>(
    initial?.taxTreatment ??
      (!hasVatNumber
        ? "zero_rated"
        : standardRateConfigured
          ? "standard"
          : "reverse_charge"),
  );
  const [frequency, setFrequency] = useState<Frequency>(
    initial?.frequency ?? "monthly",
  );
  const [interval, setInterval] = useState(String(initial?.interval ?? 1));
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [netTermsDays, setNetTermsDays] = useState(
    String(initial?.netTermsDays ?? 14),
  );
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [occurrenceLimit, setOccurrenceLimit] = useState(
    initial?.occurrenceLimit != null ? String(initial.occurrenceLimit) : "",
  );
  const [autoIssue, setAutoIssue] = useState(initial?.autoIssue ?? false);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [lines, setLines] = useState<LineDraft[]>(
    initial?.lines?.length
      ? initial.lines
      : [{ description: "", amountMajor: "" }],
  );

  const onDone = (scheduleId: string) => {
    router.push(`/invoices/recurring/${scheduleId}`);
    router.refresh();
  };

  const create = useMutation(
    trpc.recurring.create.mutationOptions({
      onSuccess: (created) => onDone(created.id),
    }),
  );
  const update = useMutation(
    trpc.recurring.update.mutationOptions({
      onSuccess: (updated) => onDone(updated.id),
    }),
  );
  const pending = create.isPending || update.isPending;
  const error = create.error ?? update.error;

  const setLine = (index: number, patch: Partial<LineDraft>) =>
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  const addLine = () =>
    setLines((prev) => [...prev, { description: "", amountMajor: "" }]);
  const removeLine = (index: number) =>
    setLines((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== index),
    );

  const submit = () => {
    const payload = {
      clientId,
      name: name.trim(),
      currency: currency.trim().toUpperCase(),
      taxTreatment: treatment,
      frequency,
      interval: Number(interval) || 1,
      startDate: new Date(`${startDate}T00:00:00.000Z`),
      endDate: endDate ? new Date(`${endDate}T00:00:00.000Z`) : null,
      occurrenceLimit: occurrenceLimit ? Number(occurrenceLimit) : null,
      netTermsDays: Number(netTermsDays) || 0,
      autoIssue,
      notes: notes.trim() || null,
      lines: lines
        .filter((line) => line.description.trim() && line.amountMajor.trim())
        .map((line) => ({
          description: line.description.trim(),
          amountMajor: line.amountMajor.trim(),
        })),
    };
    if (initial) {
      update.mutate({ scheduleId: initial.id, data: payload });
    } else {
      create.mutate(payload);
    }
  };

  return (
    <Card>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="flex flex-col gap-5"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              required
              placeholder="e.g. Acme monthly retainer"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="client">Client</Label>
            <select
              id="client"
              required
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className={selectClassName}
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="flex w-48 flex-col gap-2">
              <Label htmlFor="currency">Currency</Label>
              <CurrencySelect
                id="currency"
                required
                value={currency}
                onChange={setCurrency}
                options={currencyOptions}
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="frequency">Repeats</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Every</span>
                <Input
                  id="interval"
                  type="number"
                  min={1}
                  max={52}
                  required
                  value={interval}
                  onChange={(e) => setInterval(e.target.value)}
                  className="w-20"
                />
                <select
                  id="frequency"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as Frequency)}
                  className={`${selectClassName} flex-1`}
                >
                  <option value="weekly">week(s)</option>
                  <option value="monthly">month(s)</option>
                  <option value="quarterly">quarter(s)</option>
                  <option value="yearly">year(s)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="startDate">First invoice date</Label>
              <Input
                id="startDate"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="netTermsDays">Payment terms (days)</Label>
              <Input
                id="netTermsDays"
                type="number"
                min={0}
                max={365}
                required
                value={netTermsDays}
                onChange={(e) => setNetTermsDays(e.target.value)}
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            Each invoice is dated at its occurrence, due that many days later.
          </p>

          <div className="flex flex-wrap gap-4">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="endDate">End date (optional)</Label>
              <Input
                id="endDate"
                type="date"
                min={startDate || undefined}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="occurrenceLimit">Max invoices (optional)</Label>
              <Input
                id="occurrenceLimit"
                type="number"
                min={1}
                max={1000}
                placeholder="Unlimited"
                value={occurrenceLimit}
                onChange={(e) => setOccurrenceLimit(e.target.value)}
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            Leave both blank to keep billing until you pause or end it.
          </p>

          {hasVatNumber ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="treatment">VAT treatment</Label>
              <select
                id="treatment"
                value={treatment}
                onChange={(e) => setTreatment(e.target.value as Treatment)}
                className={selectClassName}
              >
                <option value="standard" disabled={!standardRateConfigured}>
                  Standard rate
                  {standardRateConfigured ? "" : " (set it in settings first)"}
                </option>
                <option value="zero_rated">Zero-rated</option>
                <option value="reverse_charge">EU reverse charge</option>
              </select>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label>VAT treatment</Label>
              <p className="text-sm text-muted-foreground">
                These invoices will be zero-rated for VAT. Add your VAT number in{" "}
                <Link
                  href="/settings"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  settings
                </Link>{" "}
                to charge standard-rate or EU reverse-charge VAT.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label>Lines</Label>
            <div className="flex flex-col gap-2">
              {lines.map((line, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    aria-label={`Line ${index + 1} description`}
                    placeholder="Description (e.g. Retainer)"
                    value={line.description}
                    onChange={(e) =>
                      setLine(index, { description: e.target.value })
                    }
                    className="flex-1"
                  />
                  <Input
                    aria-label={`Line ${index + 1} amount`}
                    inputMode="decimal"
                    placeholder="1500.00"
                    value={line.amountMajor}
                    onChange={(e) =>
                      setLine(index, { amountMajor: e.target.value })
                    }
                    className="w-32"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove line ${index + 1}`}
                    disabled={lines.length === 1}
                    onClick={() => removeLine(index)}
                    className="size-9 shrink-0"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              className="self-start"
              onClick={addLine}
            >
              Add line
            </Button>
            <p className="text-xs text-muted-foreground">
              Fixed amounts in {currency || "the invoice currency"}, stamped onto
              every invoice this generates.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <textarea
              id="notes"
              rows={2}
              placeholder="Printed at the foot of every generated invoice"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
            />
          </div>

          <label className="flex items-start gap-3 rounded-md border p-3">
            <input
              type="checkbox"
              checked={autoIssue}
              onChange={(e) => setAutoIssue(e.target.checked)}
              className="mt-0.5 size-4"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">
                Issue automatically when generated
              </span>
              <span className="text-xs text-muted-foreground">
                Assigns the invoice number and marks it sent without a manual
                step. You still download and send the PDF yourself. Leave off to
                review each draft before issuing.
              </span>
            </span>
          </label>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error.message}
            </p>
          ) : null}

          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending
                ? "Saving..."
                : initial
                  ? "Save changes"
                  : "Create recurring invoice"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
