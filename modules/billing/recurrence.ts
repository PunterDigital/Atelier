// Recurrence date math for recurring invoices / retainers. A pure module,
// fixture-tested like the rest of the billing core: given an occurrence date
// and a cadence, it computes the next occurrence. No clock, no database - the
// scheduler supplies dates, this decides the arithmetic.
//
// All dates are UTC-midnight, matching how invoices are dated across Clerq
// (the forms build `new Date("YYYY-MM-DDT00:00:00.000Z")`).

export type Frequency = "weekly" | "monthly" | "quarterly" | "yearly";

export type Cadence = {
  frequency: Frequency;
  // Every `interval` units of the frequency (e.g. interval 2 + monthly = every
  // two months). Must be a positive integer; the service validates it.
  interval: number;
  // The intended day-of-month for month-based cadences (1-31), captured from
  // the start date. Clamped to the target month's last day at each step so a
  // 31st anchor lands on the 30th/28th without drifting earlier over time.
  // Null for weekly (day-based, no anchor).
  anchorDay: number | null;
};

// Months advanced per step for each month-based frequency (before interval).
const MONTHS_PER_STEP: Record<Exclude<Frequency, "weekly">, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysInMonth(year: number, month0: number): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

// The anchor day a cadence should carry, derived from its start date: the
// start's day-of-month for month-based cadences, null for weekly.
export function anchorDayForStart(startDate: Date, frequency: Frequency): number | null {
  return frequency === "weekly" ? null : startDate.getUTCDate();
}

// The occurrence that follows `current` for the given cadence.
//
// Weekly steps by 7*interval whole days. Month-based cadences add the right
// number of months and set the day from the stored anchor (never from
// `current`'s possibly-clamped day), so the series stays pinned to the anchor:
// Jan 31 -> Feb 28 -> Mar 31, not Jan 31 -> Feb 28 -> Mar 28.
export function nextOccurrence(current: Date, cadence: Cadence): Date {
  if (cadence.frequency === "weekly") {
    return new Date(current.getTime() + 7 * cadence.interval * MS_PER_DAY);
  }

  const monthsToAdd = MONTHS_PER_STEP[cadence.frequency] * cadence.interval;
  const totalMonths = current.getUTCMonth() + monthsToAdd;
  const year = current.getUTCFullYear() + Math.floor(totalMonths / 12);
  const month0 = ((totalMonths % 12) + 12) % 12;
  const anchor = cadence.anchorDay ?? current.getUTCDate();
  const day = Math.min(anchor, daysInMonth(year, month0));
  return new Date(Date.UTC(year, month0, day));
}
