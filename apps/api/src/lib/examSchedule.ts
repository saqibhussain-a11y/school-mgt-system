import { DayOfWeek } from "@sms/db";

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(bStart) < timeToMinutes(aEnd);
}

const UTC_DAY_TO_DAY_OF_WEEK: Record<number, DayOfWeek | null> = {
  0: null, // Sunday — no DayOfWeek value; callers must treat this as "no
  // regular timetable that day, no conflict possible", not an error.
  1: DayOfWeek.MONDAY,
  2: DayOfWeek.TUESDAY,
  3: DayOfWeek.WEDNESDAY,
  4: DayOfWeek.THURSDAY,
  5: DayOfWeek.FRIDAY,
  6: DayOfWeek.SATURDAY,
};

// examDate/Exam.startDate are @db.Date columns — Prisma returns these as JS
// Dates at UTC midnight. .getDay() reads the LOCAL day, which shifts back a
// day in any timezone behind UTC (including local dev). Must use
// .getUTCDay().
export function dayOfWeekFromDate(date: Date): DayOfWeek | null {
  return UTC_DAY_TO_DAY_OF_WEEK[date.getUTCDay()];
}

// JS `Date` equality is reference equality — two Dates for the same calendar
// day are never `===`. Compare via this key, never via `===`, whenever "is
// this the same day" is the actual question.
export function toUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
