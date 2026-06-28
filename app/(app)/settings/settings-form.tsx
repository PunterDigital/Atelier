"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CurrencySelect } from "@/components/currency-select";
import type { CurrencyOption } from "@/lib/currencies";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTRPC } from "@/server/trpc/client";

export function SettingsForm({
  initial,
  currencyOptions,
  currentYear,
}: {
  initial: {
    name: string;
    address: string | null;
    currency: string;
    hoursPerDay: number;
    standardRatePct: string | null;
    vatNumber: string | null;
  };
  currencyOptions: CurrencyOption[];
  currentYear: number;
}) {
  const router = useRouter();
  const trpc = useTRPC();
  const [name, setName] = useState(initial.name);
  const [address, setAddress] = useState(initial.address ?? "");
  const [currency, setCurrency] = useState(initial.currency);
  const [hoursPerDay, setHoursPerDay] = useState(String(initial.hoursPerDay));
  const [standardRatePct, setStandardRatePct] = useState(
    initial.standardRatePct ?? "",
  );
  const [vatNumber, setVatNumber] = useState(initial.vatNumber ?? "");
  const [nextNumber, setNextNumber] = useState("");

  const update = useMutation(
    trpc.business.updateSettings.mutationOptions({
      onSuccess: () => router.refresh(),
    }),
  );
  const configureNumber = useMutation(
    trpc.invoices.configureNextNumber.mutationOptions({
      onSuccess: () => {
        setNextNumber("");
        router.refresh();
      },
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Business</CardTitle>
          <CardDescription>
            The entity you invoice from
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const parsedHours = Number(hoursPerDay);
              update.mutate({
                name,
                address: address.trim() || null,
                currency,
                hoursPerDay:
                  Number.isInteger(parsedHours) && parsedHours >= 1
                    ? parsedHours
                    : 8,
                standardRatePct: standardRatePct.trim() || null,
                vatNumber: vatNumber.trim() || null,
              });
            }}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="address">Address</Label>
              <textarea
                id="address"
                rows={3}
                placeholder={"12 Harbour Street\nBristol BS1 4QA\nUnited Kingdom"}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
              />
              <p className="text-sm text-muted-foreground">
                Printed on your invoices, exactly as written here
              </p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex flex-col gap-2 sm:w-64">
                <Label htmlFor="currency">Base currency</Label>
                <CurrencySelect
                  id="currency"
                  required
                  value={currency}
                  onChange={setCurrency}
                  options={currencyOptions}
                />
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="vat">Standard VAT rate (%)</Label>
                <Input
                  id="vat"
                  inputMode="decimal"
                  placeholder="21"
                  value={standardRatePct}
                  onChange={(e) => setStandardRatePct(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Used for standard-rate invoices - your jurisdiction&apos;s
                  rate, never guessed for you
                </p>
              </div>
            </div>
            <div className="flex w-44 flex-col gap-2">
              <Label htmlFor="hoursPerDay">Hours per day</Label>
              <Input
                id="hoursPerDay"
                type="number"
                min="1"
                max="24"
                step="1"
                value={hoursPerDay}
                onChange={(e) => setHoursPerDay(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Turns a day rate into an hourly rate (a {hoursPerDay || "8"}-hour
                day)
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="businessVat">VAT number</Label>
              <Input
                id="businessVat"
                placeholder="GB123456789"
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Printed on invoices - required before issuing reverse-charge
                invoices
              </p>
            </div>
            {update.error ? (
              <p role="alert" className="text-sm text-destructive">
                {update.error.message}
              </p>
            ) : null}
            <div>
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import data</CardTitle>
          <CardDescription>
            Bring clients over from another tool&apos;s CSV export
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link href="/settings/import">Import clients from CSV</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoice numbering</CardTitle>
          <CardDescription>
            Numbers run {currentYear}-0001, {currentYear}-0002, ... per year.
            Moving from another tool mid-year? Set where {currentYear}{" "}
            continues - it can only move forward, never over an issued number
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const parsed = Number(nextNumber);
              if (Number.isInteger(parsed)) {
                configureNumber.mutate({ year: currentYear, nextNumber: parsed });
              }
            }}
            className="flex items-end gap-2"
          >
            <div className="flex w-44 flex-col gap-2">
              <Label htmlFor="nextNumber">Next number for {currentYear}</Label>
              <Input
                id="nextNumber"
                type="number"
                min="1"
                max="9999"
                step="1"
                required
                placeholder="100"
                value={nextNumber}
                onChange={(e) => setNextNumber(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              disabled={configureNumber.isPending || !nextNumber}
            >
              {configureNumber.isPending ? "Saving..." : "Set"}
            </Button>
          </form>
          {configureNumber.error ? (
            <p role="alert" className="pt-2 text-sm text-destructive">
              {configureNumber.error.message}
            </p>
          ) : null}
          {configureNumber.isSuccess ? (
            <p className="pt-2 text-sm text-muted-foreground">
              Numbering updated
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
