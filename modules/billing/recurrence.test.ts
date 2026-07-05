import { describe, expect, it } from "vitest";

import { anchorDayForStart, nextOccurrence, type Cadence } from "./recurrence";

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const monthly = (anchorDay: number, interval = 1): Cadence => ({
  frequency: "monthly",
  interval,
  anchorDay,
});

describe("nextOccurrence", () => {
  it("weekly steps by 7 days times the interval, ignoring the anchor", () => {
    const weekly: Cadence = { frequency: "weekly", interval: 1, anchorDay: null };
    expect(nextOccurrence(utc("2026-06-01"), weekly)).toEqual(utc("2026-06-08"));

    const fortnightly: Cadence = {
      frequency: "weekly",
      interval: 2,
      anchorDay: null,
    };
    expect(nextOccurrence(utc("2026-06-01"), fortnightly)).toEqual(
      utc("2026-06-15"),
    );
    // Crosses a month boundary cleanly.
    expect(nextOccurrence(utc("2026-06-25"), weekly)).toEqual(utc("2026-07-02"));
  });

  it("monthly advances one month, keeping the day", () => {
    expect(nextOccurrence(utc("2026-06-15"), monthly(15))).toEqual(
      utc("2026-07-15"),
    );
  });

  it("monthly with an interval skips months", () => {
    expect(nextOccurrence(utc("2026-01-10"), monthly(10, 2))).toEqual(
      utc("2026-03-10"),
    );
  });

  it("quarterly and yearly add 3 and 12 months", () => {
    const quarterly: Cadence = {
      frequency: "quarterly",
      interval: 1,
      anchorDay: 1,
    };
    expect(nextOccurrence(utc("2026-01-01"), quarterly)).toEqual(
      utc("2026-04-01"),
    );
    const yearly: Cadence = { frequency: "yearly", interval: 1, anchorDay: 5 };
    expect(nextOccurrence(utc("2026-03-05"), yearly)).toEqual(utc("2027-03-05"));
  });

  it("rolls the year over at December", () => {
    expect(nextOccurrence(utc("2026-12-20"), monthly(20))).toEqual(
      utc("2027-01-20"),
    );
  });

  it("clamps a 31st anchor to shorter months without drifting", () => {
    // The anchor is 31: February clamps to the 28th, but March returns to the
    // 31st (we advance from the anchor, not the clamped day).
    const anchor31 = monthly(31);
    const feb = nextOccurrence(utc("2026-01-31"), anchor31);
    expect(feb).toEqual(utc("2026-02-28"));
    const mar = nextOccurrence(feb, anchor31);
    expect(mar).toEqual(utc("2026-03-31"));
    const apr = nextOccurrence(mar, anchor31);
    expect(apr).toEqual(utc("2026-04-30"));
  });

  it("lands on Feb 29 in a leap year", () => {
    expect(nextOccurrence(utc("2024-01-31"), monthly(31))).toEqual(
      utc("2024-02-29"),
    );
  });

  it("clamps a 30th anchor in February too", () => {
    expect(nextOccurrence(utc("2026-01-30"), monthly(30))).toEqual(
      utc("2026-02-28"),
    );
  });
});

describe("anchorDayForStart", () => {
  it("captures the day-of-month for month-based cadences", () => {
    expect(anchorDayForStart(utc("2026-06-15"), "monthly")).toBe(15);
    expect(anchorDayForStart(utc("2026-06-30"), "quarterly")).toBe(30);
    expect(anchorDayForStart(utc("2026-01-31"), "yearly")).toBe(31);
  });

  it("is null for weekly (day-based, no month anchor)", () => {
    expect(anchorDayForStart(utc("2026-06-15"), "weekly")).toBeNull();
  });
});
