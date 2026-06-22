"use client";

import type { CurrencyOption } from "@/lib/currencies";

// Full ISO 4217 dropdown. The option list is computed once on the server (see
// lib/currencies.ts) and passed in, so server and client render identical text
// - building it independently on each side trips a hydration mismatch because
// Node and browser ICU disagree on some currency names.
export function CurrencySelect({
  id,
  value,
  onChange,
  options,
  emptyLabel,
  required,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: CurrencyOption[];
  // When set, an empty choice is offered with this label (e.g. for
  // optional rate currencies).
  emptyLabel?: string;
  required?: boolean;
}) {
  return (
    <select
      id={id}
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
    >
      {emptyLabel !== undefined ? <option value="">{emptyLabel}</option> : null}
      {options.map((option) => (
        <option key={option.code} value={option.code}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
