"use client";

import { useMemo } from "react";

// Full ISO 4217 dropdown built from the runtime's own currency registry -
// no hand-maintained list to drift. Labels add the English display name.
export function CurrencySelect({
  id,
  value,
  onChange,
  emptyLabel,
  required,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  // When set, an empty choice is offered with this label (e.g. for
  // optional rate currencies).
  emptyLabel?: string;
  required?: boolean;
}) {
  const options = useMemo(() => {
    const names = new Intl.DisplayNames(["en"], { type: "currency" });
    return Intl.supportedValuesOf("currency").map((code) => ({
      code,
      label: `${code} - ${names.of(code) ?? code}`,
    }));
  }, []);

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
