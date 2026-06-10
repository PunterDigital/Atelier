"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Default hourly rate input pair (major-unit amount + ISO currency code).
// Conversion to exact minor units happens at submit via
// modules/billing/currency - never with floats.
export function RateFields({
  rate,
  currency,
  onRateChange,
  onCurrencyChange,
}: {
  rate: string;
  currency: string;
  onRateChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-1 flex-col gap-2">
        <Label htmlFor="defaultRate">Default hourly rate</Label>
        <Input
          id="defaultRate"
          inputMode="decimal"
          placeholder="62.50"
          value={rate}
          onChange={(e) => onRateChange(e.target.value)}
        />
      </div>
      <div className="flex w-28 flex-col gap-2">
        <Label htmlFor="rateCurrency">Currency</Label>
        <Input
          id="rateCurrency"
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
