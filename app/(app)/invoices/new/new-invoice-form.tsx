"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CurrencySelect } from "@/components/currency-select";
import type { CurrencyOption } from "@/lib/currencies";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTRPC } from "@/server/trpc/client";

const selectClassName =
  "h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40";

type Treatment = "standard" | "zero_rated" | "reverse_charge";

export function NewInvoiceForm({
  clients,
  defaultCurrency,
  currencyOptions,
  standardRateConfigured,
}: {
  clients: { id: string; name: string }[];
  defaultCurrency: string;
  currencyOptions: CurrencyOption[];
  standardRateConfigured: boolean;
}) {
  const router = useRouter();
  const trpc = useTRPC();
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [treatment, setTreatment] = useState<Treatment>(
    standardRateConfigured ? "standard" : "reverse_charge",
  );
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  const create = useMutation(
    trpc.invoices.createDraft.mutationOptions({
      onSuccess: (created) => {
        router.push(`/invoices/${created.id}`);
        router.refresh();
      },
    }),
  );

  return (
    <Card>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate({
              clientId,
              currency: currency.trim().toUpperCase(),
              taxTreatment: treatment,
              issueDate: issueDate
                ? new Date(`${issueDate}T00:00:00.000Z`)
                : null,
              dueDate: dueDate ? new Date(`${dueDate}T00:00:00.000Z`) : null,
              periodStart: periodStart
                ? new Date(`${periodStart}T00:00:00.000Z`)
                : null,
              periodEnd: periodEnd
                ? new Date(`${periodEnd}T00:00:00.000Z`)
                : null,
            });
          }}
          className="flex flex-col gap-5"
        >
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

          <div className="flex flex-col gap-2">
            <div className="flex gap-4">
              <div className="flex w-56 flex-col gap-2">
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
                <Label htmlFor="issueDate">Issue date</Label>
                <Input
                  id="issueDate"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="dueDate">Due date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Issue date is used (and printed) when you issue this draft -
              leave it blank to issue at today&apos;s date, or set it to
              backdate the invoice (e.g. a client already paid you before one
              existed).
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Billing period (optional)</Label>
            <div className="flex items-center gap-2">
              <Input
                aria-label="Billing period start"
                type="date"
                value={periodStart}
                max={periodEnd || undefined}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Input
                aria-label="Billing period end"
                type="date"
                value={periodEnd}
                min={periodStart || undefined}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              The work this invoice covers - shown alongside the issue and due
              dates.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="treatment">VAT treatment</Label>
            <select
              id="treatment"
              value={treatment}
              onChange={(e) => setTreatment(e.target.value as Treatment)}
              className={selectClassName}
            >
              <option value="standard" disabled={!standardRateConfigured}>
                Standard rate{standardRateConfigured ? "" : " (set it in settings first)"}
              </option>
              <option value="zero_rated">Zero-rated</option>
              <option value="reverse_charge">EU reverse charge</option>
            </select>
            {!standardRateConfigured ? (
              <p className="text-sm text-muted-foreground">
                Standard-rate invoicing needs your VAT rate -{" "}
                <Link
                  href="/settings"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  set it in settings
                </Link>
              </p>
            ) : null}
          </div>

          {create.error ? (
            <p role="alert" className="text-sm text-destructive">
              {create.error.message}
            </p>
          ) : null}

          <div className="flex gap-2">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating..." : "Create draft"}
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
