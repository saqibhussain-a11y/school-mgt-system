import type { DayOfWeek } from "@sms/db";
import { dayOfWeekFromDate } from "./examSchedule";

// Every school on the platform is in Pakistan. The server itself may run in
// UTC (Render) or anything else, so "today" and clock-time rules must never
// read the server's own clock fields.
export const SCHOOL_TIME_ZONE = "Asia/Karachi";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SCHOOL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function schoolClock(now: Date) {
  const parts = Object.fromEntries(partsFormatter.formatToParts(now).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

// The school's calendar day as UTC midnight — the same shape Prisma uses
// for @db.Date columns, so it compares directly against them.
export function schoolToday(now = new Date()): Date {
  const { year, month, day } = schoolClock(now);
  return new Date(Date.UTC(year, month - 1, day));
}

export function schoolMinutesNow(now = new Date()): number {
  const { hour, minute } = schoolClock(now);
  return hour * 60 + minute;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

export function wholeDaysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

// date-only values (UTC midnight) → "YYYY-MM-DD"
export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseDateKey(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || dateKey(date) !== value ? null : date;
}

export function isSchoolDay(date: Date, workingDays: DayOfWeek[]): boolean {
  const day = dayOfWeekFromDate(date);
  return day !== null && workingDays.includes(day);
}

export function formatSchoolDate(date: Date): string {
  return date.toLocaleDateString("en-PK", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
