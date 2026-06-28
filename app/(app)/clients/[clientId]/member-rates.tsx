"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";

import type { RateUnit } from "@/components/rate-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { majorToMinor, minorToMajor } from "@/modules/billing/currency";
import { useTRPC } from "@/server/trpc/client";

// Per-client team-member rates. Self-contained: reads the team roster and the
// existing rates, derives what the viewer may do from the team permission set,
// and hides the internal-cost column entirely unless they can view profit.
function rateLabel(minor: number, currency: string, unit: string): string {
  return `${minorToMajor(minor, currency)} ${currency}/${unit === "day" ? "day" : "h"}`;
}

type MemberRateRow = {
  userId: string;
  name: string;
  email: string;
  billRateMinor: number;
  billRateCurrency: string;
  billRateUnit: string;
  budgetMinor: number | null;
  budgetCurrency: string | null;
  internalCostMinor?: number | null;
  internalCostCurrency?: string | null;
  internalCostUnit?: string;
};

export function MemberRates({ clientId }: { clientId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const team = useQuery(trpc.team.list.queryOptions(undefined, { retry: false }));
  const ratesOptions = trpc.clients.listMemberRates.queryOptions({ clientId });
  const rates = useQuery(ratesOptions);

  const permissions: string[] = team.data?.permissions ?? [];
  const canManage = permissions.includes("clients.manageRates");
  const canViewProfit = permissions.includes("reports.viewProfit");

  const [userId, setUserId] = useState("");
  const [bill, setBill] = useState("");
  const [billCurrency, setBillCurrency] = useState("EUR");
  const [billUnit, setBillUnit] = useState<RateUnit>("day");
  const [cost, setCost] = useState("");
  const [budget, setBudget] = useState("");
  const [error, setError] = useState<string | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ratesOptions.queryKey });

  const setRate = useMutation(
    trpc.clients.setMemberRate.mutationOptions({
      onSuccess: () => {
        invalidate();
        setUserId("");
        setBill("");
        setCost("");
        setBudget("");
        setError(null);
      },
      onError: (e) => setError(e.message),
    }),
  );
  const removeRate = useMutation(
    trpc.clients.removeMemberRate.mutationOptions({ onSuccess: invalidate }),
  );

  // Can't manage and nothing to show: render nothing rather than an empty card.
  const rows = (rates.data ?? []) as MemberRateRow[];
  if (!canManage && rows.length === 0) return null;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!userId) {
      setError("Pick a team member");
      return;
    }
    const code = billCurrency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) {
      setError("Use a three-letter currency code like EUR");
      return;
    }
    const billRateMinor = majorToMinor(bill, code);
    if (!bill.trim() || billRateMinor === null) {
      setError("Enter a valid bill rate");
      return;
    }
    const data: {
      userId: string;
      billRateMinor: number;
      billRateCurrency: string;
      billRateUnit: RateUnit;
      internalCostMinor?: number | null;
      internalCostCurrency?: string | null;
      internalCostUnit?: RateUnit;
      budgetMinor?: number | null;
      budgetCurrency?: string | null;
    } = {
      userId,
      billRateMinor,
      billRateCurrency: code,
      billRateUnit: billUnit,
    };
    if (canViewProfit && cost.trim()) {
      const costMinor = majorToMinor(cost, code);
      if (costMinor === null) {
        setError("Enter a valid internal cost");
        return;
      }
      data.internalCostMinor = costMinor;
      data.internalCostCurrency = code;
      data.internalCostUnit = billUnit;
    }
    if (budget.trim()) {
      const budgetMinor = majorToMinor(budget, code);
      if (budgetMinor === null) {
        setError("Enter a valid budget");
        return;
      }
      data.budgetMinor = budgetMinor;
      data.budgetCurrency = code;
    }
    setRate.mutate({ clientId, data });
  }

  const members = team.data?.members ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team &amp; rates</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No per-member rates yet. The client default applies to everyone.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((row) => (
              <li key={row.userId} className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{row.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Bills at{" "}
                    {rateLabel(
                      row.billRateMinor,
                      row.billRateCurrency,
                      row.billRateUnit,
                    )}
                    {canViewProfit &&
                    row.internalCostMinor != null &&
                    row.internalCostCurrency
                      ? ` · costs ${rateLabel(
                          row.internalCostMinor,
                          row.internalCostCurrency,
                          row.internalCostUnit ?? "hour",
                        )}`
                      : ""}
                    {row.budgetMinor != null && row.budgetCurrency
                      ? ` · budget ${minorToMajor(
                          row.budgetMinor,
                          row.budgetCurrency,
                        )} ${row.budgetCurrency}`
                      : ""}
                  </div>
                </div>
                {canManage ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${row.name}'s rate`}
                    onClick={() =>
                      removeRate.mutate({ clientId, userId: row.userId })
                    }
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {canManage ? (
          <form
            onSubmit={submit}
            className="flex flex-col gap-3 border-t pt-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="memberSelect">Member</Label>
              <select
                id="memberSelect"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
              >
                <option value="">Select a team member…</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name} ({m.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="memberBill">Bill rate</Label>
                <Input
                  id="memberBill"
                  inputMode="decimal"
                  placeholder="240"
                  value={bill}
                  onChange={(e) => setBill(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2 sm:w-24">
                <Label htmlFor="memberUnit">Per</Label>
                <select
                  id="memberUnit"
                  value={billUnit}
                  onChange={(e) => setBillUnit(e.target.value as RateUnit)}
                  className="h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
                >
                  <option value="hour">Hour</option>
                  <option value="day">Day</option>
                </select>
              </div>
              <div className="flex flex-col gap-2 sm:w-24">
                <Label htmlFor="memberCurrency">Currency</Label>
                <Input
                  id="memberCurrency"
                  maxLength={3}
                  placeholder="EUR"
                  className="uppercase"
                  value={billCurrency}
                  onChange={(e) => setBillCurrency(e.target.value)}
                />
              </div>
            </div>
            {canViewProfit ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="memberCost">
                  Internal cost (what you pay them, optional)
                </Label>
                <Input
                  id="memberCost"
                  inputMode="decimal"
                  placeholder="220"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                />
              </div>
            ) : null}
            <div className="flex flex-col gap-2">
              <Label htmlFor="memberBudget">Budget (optional)</Label>
              <Input
                id="memberBudget"
                inputMode="decimal"
                placeholder="10000"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </div>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <div>
              <Button type="submit" size="sm" disabled={setRate.isPending}>
                {setRate.isPending ? "Saving…" : "Save member rate"}
              </Button>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
