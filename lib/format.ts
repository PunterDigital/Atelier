import { minorToMajor } from "@/modules/billing/currency";

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

// Durations render as "2h 30m" in prose per the design system.
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) {
    return `${m}m`;
  }
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
