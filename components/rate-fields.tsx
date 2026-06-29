"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type RateUnit = "hour" | "day";

// Default rate input: a major-unit amount + ISO currency code, and optionally
// a per-hour / per-day unit toggle. Conversion to exact minor units happens at
// submit via modules/billing/currency - never with floats. A day rate is
// divided into an effective hourly rate by the time module at entry creation;
// here it is just captured verbatim.
export function RateFields({
  rate,
  currency,
  unit,
  onRateChange,
  onCurrencyChange,
  onUnitChange,
  idPrefix = "default",
}: {
  rate: string;
  currency: string;
  // When provided, the hour/day toggle is shown and the label follows it.
  unit?: RateUnit;
  onRateChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
  onUnitChange?: (value: RateUnit) => void;
  idPrefix?: string;
}) {
  const showUnit = unit !== undefined && onUnitChange !== undefined;
  const label = unit === "day" ? "Default day rate" : "Default hourly rate";
  const rateId = `${idPrefix}Rate`;
  const currencyId = `${idPrefix}RateCurrency`;
  const unitId = `${idPrefix}RateUnit`;

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <div className="flex flex-1 flex-col gap-2">
        <Label htmlFor={rateId}>{showUnit ? label : "Default hourly rate"}</Label>
        <Input
          id={rateId}
          inputMode="decimal"
          placeholder="62.50"
          value={rate}
          onChange={(e) => onRateChange(e.target.value)}
        />
      </div>
      {showUnit ? (
        <div className="flex flex-col gap-2 sm:w-28">
          <Label htmlFor={unitId}>Per</Label>
          <select
            id={unitId}
            value={unit}
            onChange={(e) => onUnitChange(e.target.value as RateUnit)}
            className="h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            <option value="hour">Hour</option>
            <option value="day">Day</option>
          </select>
        </div>
      ) : null}
      <div className="flex flex-col gap-2 sm:w-28">
        <Label htmlFor={currencyId}>Currency</Label>
        <Input
          id={currencyId}
          maxLength={3}
          placeholder="EUR"
          className="uppercase"
          value={currency}
          onChange={(e) => onCurrencyChange(e.target.value)}
        />
      </div>
    </div>
  );
}
