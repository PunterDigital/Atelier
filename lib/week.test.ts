import { describe, expect, it } from "vitest";

import { addDays, parseWeekParam, startOfWeek, toDateKey } from "./week";

describe("week math (UTC, Monday start)", () => {
  it("finds Monday from any weekday", () => {
    // 2026-06-10 is a Wednesday
    expect(toDateKey(startOfWeek(new Date("2026-06-10T15:30:00Z")))).toBe(
      "2026-06-08",
    );
    // Sunday belongs to the week that started the previous Monday
    expect(toDateKey(startOfWeek(new Date("2026-06-14T23:59:59Z")))).toBe(
      "2026-06-08",
    );
    // Monday is its own week start
    expect(toDateKey(startOfWeek(new Date("2026-06-08T00:00:00Z")))).toBe(
      "2026-06-08",
    );
  });

  it("adds days across month boundaries", () => {
    expect(toDateKey(addDays(new Date("2026-06-29T00:00:00Z"), 7))).toBe(
      "2026-07-06",
    );
  });

  it("normalizes the week query param and rejects garbage", () => {
    expect(toDateKey(parseWeekParam("2026-06-11"))).toBe("2026-06-08");
    const fallback = parseWeekParam("not-a-date");
    expect(fallback).toEqual(startOfWeek(new Date()));
  });
});
