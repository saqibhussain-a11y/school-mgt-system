import { describe, expect, it } from "vitest";
import { DayOfWeek } from "@sms/db";
import { dayOfWeekFromDate, rangesOverlap, timeToMinutes, toUtcDateKey, toUtcMidnight } from "./examSchedule";

describe("timeToMinutes / rangesOverlap", () => {
  it("converts HH:mm to minutes since midnight", () => {
    expect(timeToMinutes("09:00")).toBe(540);
    expect(timeToMinutes("00:00")).toBe(0);
  });

  it("detects overlapping ranges", () => {
    expect(rangesOverlap("09:00", "11:00", "10:00", "12:00")).toBe(true);
  });

  it("does not flag back-to-back ranges as overlapping", () => {
    expect(rangesOverlap("09:00", "11:00", "11:00", "12:00")).toBe(false);
  });
});

describe("dayOfWeekFromDate — UTC-safety", () => {
  it("reads the UTC day, not the local day", () => {
    // 2026-08-10 is a Monday in UTC.
    expect(dayOfWeekFromDate(new Date("2026-08-10T00:00:00.000Z"))).toBe(DayOfWeek.MONDAY);
  });

  it("returns null for Sunday — no DayOfWeek enum value exists for it", () => {
    // 2026-08-09 is a Sunday in UTC.
    expect(dayOfWeekFromDate(new Date("2026-08-09T00:00:00.000Z"))).toBeNull();
  });
});

describe("toUtcDateKey / toUtcMidnight — the exam-session-desync fix", () => {
  it("produces the same key for two distinct Date objects on the same UTC day", () => {
    const a = new Date("2026-09-21T00:00:00.000Z");
    const b = new Date(a.getTime());
    // Two different object references — `===` would say false; the whole
    // point of toUtcDateKey is comparing by this instead.
    expect(a).not.toBe(b);
    expect(toUtcDateKey(a)).toBe(toUtcDateKey(b));
    expect(toUtcDateKey(a)).toBe("2026-09-21");
  });

  it("produces different keys for different days", () => {
    expect(toUtcDateKey(new Date("2026-09-21T00:00:00.000Z"))).not.toBe(
      toUtcDateKey(new Date("2026-09-22T00:00:00.000Z")),
    );
  });

  it("normalizes any time-of-day to UTC midnight on the same calendar day", () => {
    const midnight = toUtcMidnight(new Date("2026-09-21T15:42:07.000Z"));
    expect(midnight.toISOString()).toBe("2026-09-21T00:00:00.000Z");
  });
});
