import { minorToMajor, minorUnitDigits } from "@/modules/billing/currency";

// Human, abbreviated dates per the design system's content rules
// ("14 Jun", "14 Jun 2026").
const sameYear = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});
const otherYear = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatDate(date: Date, now: Date = new Date()): string {
  return date.getFullYear() === now.getFullYear()
    ? sameYear.format(date)
    : otherYear.format(date);
}

// Documents (invoices, PDFs) always carry the year - they get archived.
export function formatDateFull(date: Date): string {
  return otherYear.format(date);
}

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(date: Date, now: Date = new Date()): string {
  return `${formatDate(date, now)}, ${timeFormat.format(date)}`;
}

// Running timers render as "02:30:00" per the design system.
export function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// Rates render via the billing module's exact minor-unit conversion -
// display only, billing math never goes through here.
export function formatRate(rateMinor: number, currency: string): string {
  return `${minorToMajor(rateMinor, currency)} ${currency}/h`;
}

const NUMERIC_PART_TYPES = new Set([
  "integer",
  "group",
  "decimal",
  "fraction",
]);

// Money display: symbol + grouped + the currency's minor digits
// (GBP 3,799.00 style per the design system). Display only - the Number
// round-trip is exact far beyond any realistic invoice total, and money
// math never goes through here.
//
// en-GB's CLDR data glues the currency symbol straight to the digits
// (formatToParts gives no "literal" part between them, unlike e.g. de-DE
// which inserts one) - so on screen and in the PDF the symbol runs into
// the amount. formatToParts + a non-breaking space patches that boundary
// back in without disturbing locales that already separate them.
export function formatMoney(minor: number, currency: string): string {
  const major = Number(minorToMajor(minor, currency));
  const parts = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).formatToParts(major);
  let result = "";
  parts.forEach((part, index) => {
    const prevType = parts[index - 1]?.type;
    const atCurrencyBoundary =
      (part.type === "currency" && NUMERIC_PART_TYPES.has(prevType ?? "")) ||
      (prevType === "currency" && NUMERIC_PART_TYPES.has(part.type));
    if (atCurrencyBoundary) {
      result += " ";
    }
    result += part.value;
  });
  return result;
}

// Money with the ISO code after the amount ("10,000.00 EUR") rather than a
// symbol - used where the currency must be unambiguous, like the invoice's
// Balance Due block. Grouped, with the currency's exact minor-unit digits.
export function formatMoneyCode(minor: number, currency: string): string {
  const major = Number(minorToMajor(minor, currency));
  const digits = minorUnitDigits(currency);
  const amount = new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(major);
  return `${amount} ${currency.toUpperCase()}`;
}

// Compact h:mm for task cards ("0:00", "2:30") - always visible even at
// zero so a fresh task reads as trackable.
export function formatHoursClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

// Durations render as "2h 30m" in prose per the design system.
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) {
    return `${m}m`;
  }
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
