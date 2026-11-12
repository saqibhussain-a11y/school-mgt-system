import { describe, expect, it } from "vitest";
import { DayOfWeek } from "@sms/db";
import { isSchoolDay, parseDateKey, schoolMinutesNow, schoolToday } from "./schoolTime";

describe("schoolTime — Pakistan Standard Time (UTC+5)", () => {
  it("rolls over to the next day at midnight in Pakistan, not at UTC midnight", () => {
    // 20:30 UTC on 12 Nov = 01:30 PKT on 13 Nov
    expect(schoolToday(new Date("2026-11-12T20:30:00Z")).toISOString()).toBe("2026-11-13T00:00:00.000Z");
    // 18:59 UTC = 23:59 PKT, still the 12th
    expect(schoolToday(new Date("2026-11-12T18:59:00Z")).toISOString()).toBe("2026-11-12T00:00:00.000Z");
  });

  it("reads the clock in Pakistan time", () => {
    // 03:15 UTC = 08:15 PKT
    expect(schoolMinutesNow(new Date("2026-11-12T03:15:00Z"))).toBe(8 * 60 + 15);
    // 21:00 UTC = 02:00 PKT next day
    expect(schoolMinutesNow(new Date("2026-11-12T21:00:00Z"))).toBe(2 * 60);
  });

  it("treats Sunday and unselected days as non-school days", () => {
    const monToSat = [
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY,
      DayOfWeek.SATURDAY,
    ];
    expect(isSchoolDay(parseDateKey("2026-11-15")!, monToSat)).toBe(false); // Sunday
    expect(isSchoolDay(parseDateKey("2026-11-14")!, monToSat)).toBe(true); // Saturday
    expect(isSchoolDay(parseDateKey("2026-11-14")!, monToSat.slice(0, 5))).toBe(false);
  });

  it("rejects malformed and impossible dates", () => {
    expect(parseDateKey("2026-02-30")).toBeNull();
    expect(parseDateKey("12-11-2026")).toBeNull();
    expect(parseDateKey("2026-11-12")?.toISOString()).toBe("2026-11-12T00:00:00.000Z");
  });
});
