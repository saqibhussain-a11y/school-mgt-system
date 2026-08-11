// examDate is a @db.Date column (UTC midnight). Every helper here stays in
// UTC end-to-end — .toLocaleDateString()-style local-time formatting would
// silently shift labels a day early for timezone-behind-UTC users, and this
// grid is the first place in the app that does date arithmetic client-side
// rather than just passing an <input type="date"> string straight through.
// Every date exchanged with the API is a bare "YYYY-MM-DD" string.

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function isSundayKey(dateKey: string): boolean {
  return new Date(dateKey).getUTCDay() === 0;
}

export function mondayKeyFor(dateKey: string): string {
  const date = new Date(dateKey);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  return toDateKey(addUtcDays(date, -daysSinceMonday));
}

export function dayLabel(dateKey: string): string {
  const d = new Date(dateKey);
  return `${WEEKDAY_LABELS[d.getUTCDay()]} ${d.getUTCDate()}`;
}

export function weekLabel(mondayKey: string): string {
  const d = new Date(mondayKey);
  return `Week of ${MONTH_LABELS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function fullDateLabel(dateKey: string): string {
  const d = new Date(dateKey);
  return `${WEEKDAY_LABELS[d.getUTCDay()]}, ${MONTH_LABELS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export interface DatesheetWeek {
  mondayKey: string;
  days: string[];
}

// Every non-Sunday day from start to end (inclusive), grouped by the Monday
// that starts its week — chronological iteration means Map insertion order
// already matches display order, no separate sort needed.
export function buildWeeks(startKey: string, endKey: string): DatesheetWeek[] {
  const weeks = new Map<string, string[]>();
  const end = new Date(endKey);
  let cursor = new Date(startKey);
  while (cursor <= end) {
    const key = toDateKey(cursor);
    if (!isSundayKey(key)) {
      const mondayKey = mondayKeyFor(key);
      const list = weeks.get(mondayKey) ?? [];
      list.push(key);
      weeks.set(mondayKey, list);
    }
    cursor = addUtcDays(cursor, 1);
  }
  return Array.from(weeks.entries()).map(([mondayKey, days]) => ({ mondayKey, days }));
}
