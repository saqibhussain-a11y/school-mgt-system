export function formatRole(role: string) {
  return role
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

export function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function toDateInputValue(value: string | Date) {
  return new Date(value).toISOString().slice(0, 10);
}

// Every school on the platform is in Pakistan — "today" and clock times
// follow Pakistan Standard Time whatever the viewer's device is set to.
export const SCHOOL_TIME_ZONE = "Asia/Karachi";

const schoolDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SCHOOL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// "YYYY-MM-DD" for <input type="date">
export function schoolTodayInputValue() {
  return schoolDateFormatter.format(new Date());
}

// "YYYY-MM" for <input type="month">
export function schoolMonthInputValue() {
  return schoolTodayInputValue().slice(0, 7);
}

export function formatSchoolTime(value: string | Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-PK", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: SCHOOL_TIME_ZONE,
  });
}

// Date-only values are stored at UTC midnight; format them in UTC so the
// calendar day never shifts.
export function formatCalendarDate(value: string | Date) {
  return new Date(value).toLocaleDateString("en-PK", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// "13:30" → "1:30 PM"
export function formatClockTime(hhmm: string | null) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(2000, 0, 1, h, m)).toLocaleTimeString("en-PK", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

// Fixed to PKR/en-PK regardless of the viewer's own browser locale — this
// is the business's one operating currency, not something that should
// change per visitor.
export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(
    value,
  );
}

export function formatRelativeTime(value: string | Date) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(value);
}
