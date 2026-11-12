import { prisma, LeaveStatus, Role, runAsPlatform, StaffStatus, type DayOfWeek } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";
import { putObject, getDownloadUrl } from "../lib/storage";
import { haversineMeters } from "../lib/geo";
import { queueEmails } from "../lib/queue";
import { checkOutReminderEmail } from "../lib/emailTemplates";
import { timeToMinutes } from "../lib/examSchedule";
import { addDays, dateKey, formatMinutes, isSchoolDay, schoolMinutesNow, schoolToday } from "../lib/schoolTime";
import { staffAttendanceSettingsService } from "./staffAttendanceSettings.service";
import { inAppNotificationService } from "./inAppNotification.service";

const NOTIFY_ROLES: Role[] = [Role.SCHOOL_ADMIN, Role.PRINCIPAL];

// Server-chosen, never the client's claimed mimetype — selfies render inline.
export const STAFF_PHOTO_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

// When a school has no check-out window, reminders go out at 4:00 PM.
const DEFAULT_REMINDER_MINUTES = 16 * 60;
const REMINDER_LEAD_MINUTES = 30;

export type StaffDayStatus = "PRESENT" | "ABSENT" | "ON_LEAVE" | "HOLIDAY" | "OFF_DAY" | "PENDING" | "UPCOMING" | "NOT_JOINED";

function isWithinWindow(start: string | null, end: string | null, nowMinutes: number): boolean {
  if (!start || !end) return true;
  return nowMinutes >= timeToMinutes(start) && nowMinutes <= timeToMinutes(end);
}

interface CheckPhoto {
  buffer: Buffer;
  ext: string;
}

interface CheckInput {
  lat: number;
  lng: number;
  accuracy?: number;
  photo: CheckPhoto;
}

export async function evaluateLocation(schoolId: string, input: CheckInput, action: "check in" | "check out") {
  const settings = await staffAttendanceSettingsService.getOrCreate(schoolId);
  if (settings.officeLat === null || settings.officeLng === null) return { flagged: false };
  const distance = haversineMeters(input.lat, input.lng, settings.officeLat, settings.officeLng);
  if (distance <= settings.radiusMeters) return { flagged: false };

  if (settings.blockOutsideRadius) {
    const poorFix = input.accuracy !== undefined && input.accuracy > settings.radiusMeters;
    throw new HttpError(
      403,
      `You're about ${Math.round(distance)} m from school. You can only ${action} within ${settings.radiusMeters} m of the school.` +
        (poorFix
          ? ` Your phone's location is only accurate to about ±${Math.round(input.accuracy!)} m right now — turn on GPS/high-accuracy location and try again.`
          : ""),
    );
  }
  return { flagged: true };
}

async function notifyIfFlagged(
  schoolId: string,
  staffName: string,
  action: "checked in" | "checked out",
  flagged: boolean,
) {
  if (!flagged) return;
  const reviewers = await prisma.user.findMany({
    where: { schoolId, role: { in: NOTIFY_ROLES } },
    select: { id: true },
  });
  await inAppNotificationService.notifyMany(schoolId, reviewers.map((r) => r.id), {
    type: "staff_attendance_flagged",
    title: "Staff check-in outside office range",
    body: `${staffName} ${action} from outside the configured office radius`,
    link: "/dashboard/staff-attendance",
  });
}

const withUser = { staff: { include: { user: { select: { firstName: true, lastName: true } } } } };

async function withPhotoUrls<T extends { checkInPhotoKey: string | null; checkOutPhotoKey: string | null }>(
  row: T,
) {
  return {
    ...row,
    checkInPhotoUrl: row.checkInPhotoKey ? await getDownloadUrl(row.checkInPhotoKey) : null,
    checkOutPhotoUrl: row.checkOutPhotoKey ? await getDownloadUrl(row.checkOutPhotoKey) : null,
  };
}

interface DayContext {
  date: Date;
  today: Date;
  nowMinutes: number;
  schoolWorkingDays: DayOfWeek[];
  holiday: boolean;
  checkInWindowEnd: string | null;
}

export function staffDayStatus(
  ctx: DayContext,
  staff: { workingDays: DayOfWeek[]; joinedOn: Date },
  checkedIn: boolean,
  onLeave: boolean,
): StaffDayStatus {
  if (checkedIn) return "PRESENT";
  if (ctx.date > ctx.today) return "UPCOMING";
  if (ctx.date < staff.joinedOn) return "NOT_JOINED";
  if (ctx.holiday) return "HOLIDAY";
  if (!isSchoolDay(ctx.date, ctx.schoolWorkingDays) || !isSchoolDay(ctx.date, staff.workingDays)) return "OFF_DAY";
  if (onLeave) return "ON_LEAVE";
  if (ctx.date.getTime() === ctx.today.getTime()) {
    const closed = ctx.checkInWindowEnd !== null && ctx.nowMinutes > timeToMinutes(ctx.checkInWindowEnd);
    return closed ? "ABSENT" : "PENDING";
  }
  return "ABSENT";
}

// Everything the roster and monthly report need for a date range, in one
// round of queries.
async function loadRange(schoolId: string, from: Date, to: Date) {
  const [school, settings, staff, rows, holidays] = await Promise.all([
    prisma.school.findUniqueOrThrow({ where: { id: schoolId }, select: { workingDays: true } }),
    staffAttendanceSettingsService.getOrCreate(schoolId),
    prisma.staff.findMany({
      where: { schoolId, status: StaffStatus.ACTIVE },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { user: { firstName: "asc" } },
    }),
    prisma.staffAttendance.findMany({ where: { schoolId, date: { gte: from, lte: to } } }),
    prisma.holiday.findMany({ where: { schoolId, date: { gte: from, lte: to } }, select: { date: true } }),
  ]);
  const leaves = await prisma.leaveRequest.findMany({
    where: {
      schoolId,
      status: LeaveStatus.APPROVED,
      userId: { in: staff.map((s) => s.userId) },
      startDate: { lte: to },
      endDate: { gte: from },
    },
    select: { userId: true, startDate: true, endDate: true },
  });

  const rowByKey = new Map(rows.map((r) => [`${r.staffId}|${dateKey(r.date)}`, r]));
  const holidayKeys = new Set(holidays.map((h) => dateKey(h.date)));
  const onLeave = (userId: string, date: Date) =>
    leaves.some((l) => l.userId === userId && l.startDate <= date && l.endDate >= date);

  return { school, settings, staff, rowByKey, holidayKeys, onLeave };
}

export const staffAttendanceService = {
  async checkIn(schoolId: string, staffId: string, input: CheckInput) {
    const settings = await staffAttendanceSettingsService.getOrCreate(schoolId);
    const now = new Date();
    if (!isWithinWindow(settings.checkInWindowStart, settings.checkInWindowEnd, schoolMinutesNow(now))) {
      throw new HttpError(
        400,
        `Check-in is only allowed between ${settings.checkInWindowStart} and ${settings.checkInWindowEnd} (Pakistan time)`,
      );
    }

    const date = schoolToday(now);
    const existing = await prisma.staffAttendance.findUnique({
      where: { staffId_date: { staffId, date } },
    });
    if (existing?.checkInAt) {
      throw new HttpError(409, "Already checked in today");
    }

    const { flagged } = await evaluateLocation(schoolId, input, "check in");
    const key = `schools/${schoolId}/staff-attendance/${staffId}/${dateKey(date)}-in-${Date.now()}${input.photo.ext}`;
    await putObject(key, input.photo.buffer, STAFF_PHOTO_TYPES[input.photo.ext]);

    const row = await prisma.staffAttendance.upsert({
      where: { staffId_date: { staffId, date } },
      create: {
        schoolId,
        staffId,
        date,
        checkInAt: now,
        checkInLat: input.lat,
        checkInLng: input.lng,
        checkInPhotoKey: key,
        checkInFlagged: flagged,
      },
      update: {
        checkInAt: now,
        checkInLat: input.lat,
        checkInLng: input.lng,
        checkInPhotoKey: key,
        checkInFlagged: flagged,
      },
      include: withUser,
    });

    await notifyIfFlagged(schoolId, `${row.staff.user.firstName} ${row.staff.user.lastName}`, "checked in", flagged);
    return withPhotoUrls(row);
  },

  async checkOut(schoolId: string, staffId: string, input: CheckInput) {
    const settings = await staffAttendanceSettingsService.getOrCreate(schoolId);
    const now = new Date();
    if (!isWithinWindow(settings.checkOutWindowStart, settings.checkOutWindowEnd, schoolMinutesNow(now))) {
      throw new HttpError(
        400,
        `Check-out is only allowed between ${settings.checkOutWindowStart} and ${settings.checkOutWindowEnd} (Pakistan time)`,
      );
    }

    const date = schoolToday(now);
    const existing = await prisma.staffAttendance.findUnique({
      where: { staffId_date: { staffId, date } },
    });
    if (!existing?.checkInAt) {
      throw new HttpError(400, "Check in before checking out");
    }
    if (existing.checkOutAt) {
      throw new HttpError(409, "Already checked out today");
    }

    const { flagged } = await evaluateLocation(schoolId, input, "check out");
    const key = `schools/${schoolId}/staff-attendance/${staffId}/${dateKey(date)}-out-${Date.now()}${input.photo.ext}`;
    await putObject(key, input.photo.buffer, STAFF_PHOTO_TYPES[input.photo.ext]);

    const row = await prisma.staffAttendance.update({
      where: { staffId_date: { staffId, date } },
      data: {
        checkOutAt: now,
        checkOutLat: input.lat,
        checkOutLng: input.lng,
        checkOutPhotoKey: key,
        checkOutFlagged: flagged,
      },
      include: withUser,
    });

    await notifyIfFlagged(schoolId, `${row.staff.user.firstName} ${row.staff.user.lastName}`, "checked out", flagged);
    return withPhotoUrls(row);
  },

  async getToday(schoolId: string, staffId: string) {
    const row = await prisma.staffAttendance.findUnique({
      where: { staffId_date: { staffId, date: schoolToday() } },
    });
    return row ? withPhotoUrls(row) : null;
  },

  async listForStaff(schoolId: string, staffId: string) {
    const rows = await prisma.staffAttendance.findMany({
      where: { schoolId, staffId },
      orderBy: { date: "desc" },
      take: 90,
    });
    return Promise.all(rows.map(withPhotoUrls));
  },

  // Every active staff member for one day, with a status even when they
  // never checked in (absent, on leave, off day, holiday).
  async getRosterForDate(schoolId: string, date: Date, now = new Date()) {
    const { school, settings, staff, rowByKey, holidayKeys, onLeave } = await loadRange(schoolId, date, date);
    const ctx: DayContext = {
      date,
      today: schoolToday(now),
      nowMinutes: schoolMinutesNow(now),
      schoolWorkingDays: school.workingDays,
      holiday: holidayKeys.has(dateKey(date)),
      checkInWindowEnd: settings.checkInWindowEnd,
    };

    return Promise.all(
      staff.map(async (s) => {
        const row = rowByKey.get(`${s.id}|${dateKey(date)}`);
        const status = staffDayStatus(
          ctx,
          { workingDays: s.workingDays, joinedOn: schoolToday(s.joiningDate) },
          !!row?.checkInAt,
          onLeave(s.userId, date),
        );
        return {
          staffId: s.id,
          firstName: s.user.firstName,
          lastName: s.user.lastName,
          designation: s.designation,
          status,
          checkInAt: row?.checkInAt ?? null,
          checkInFlagged: row?.checkInFlagged ?? false,
          checkInPhotoUrl: row?.checkInPhotoKey ? await getDownloadUrl(row.checkInPhotoKey) : null,
          checkOutAt: row?.checkOutAt ?? null,
          checkOutFlagged: row?.checkOutFlagged ?? false,
          checkOutPhotoUrl: row?.checkOutPhotoKey ? await getDownloadUrl(row.checkOutPhotoKey) : null,
          missedCheckOut: !!row?.checkInAt && !row.checkOutAt && date < ctx.today,
        };
      }),
    );
  },

  // Per-staff totals for one calendar month, counted up to today.
  async getMonthlyReport(schoolId: string, year: number, month: number, now = new Date()) {
    const from = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0));
    const today = schoolToday(now);
    const { school, settings, staff, rowByKey, holidayKeys, onLeave } = await loadRange(schoolId, from, monthEnd);
    const nowMinutes = schoolMinutesNow(now);

    let schoolDays = 0;
    for (let d = from; d <= monthEnd && d <= today; d = addDays(d, 1)) {
      if (isSchoolDay(d, school.workingDays) && !holidayKeys.has(dateKey(d))) schoolDays++;
    }

    const rows = staff.map((s) => {
      const totals = { present: 0, absent: 0, onLeave: 0, flagged: 0, missedCheckOut: 0 };
      const joinedOn = schoolToday(s.joiningDate);
      for (let d = from; d <= monthEnd && d <= today; d = addDays(d, 1)) {
        const row = rowByKey.get(`${s.id}|${dateKey(d)}`);
        const status = staffDayStatus(
          {
            date: d,
            today,
            nowMinutes,
            schoolWorkingDays: school.workingDays,
            holiday: holidayKeys.has(dateKey(d)),
            checkInWindowEnd: settings.checkInWindowEnd,
          },
          { workingDays: s.workingDays, joinedOn },
          !!row?.checkInAt,
          onLeave(s.userId, d),
        );
        if (status === "PRESENT") totals.present++;
        else if (status === "ABSENT") totals.absent++;
        else if (status === "ON_LEAVE") totals.onLeave++;
        if (row?.checkInFlagged || row?.checkOutFlagged) totals.flagged++;
        if (row?.checkInAt && !row.checkOutAt && d < today) totals.missedCheckOut++;
      }
      const counted = totals.present + totals.absent;
      return {
        staffId: s.id,
        firstName: s.user.firstName,
        lastName: s.user.lastName,
        designation: s.designation,
        ...totals,
        attendancePercentage: counted > 0 ? Math.round((totals.present / counted) * 1000) / 10 : null,
      };
    });

    return { month: `${year}-${String(month).padStart(2, "0")}`, schoolDays, staff: rows };
  },

  // Runs every few minutes from the scheduled-tasks worker, across every
  // school. Each row is claimed before notifying, so a reminder goes out
  // once even with several API instances running.
  async sendCheckOutReminders(now = new Date()) {
    const today = schoolToday(now);
    const nowMinutes = schoolMinutesNow(now);

    return runAsPlatform(async () => {
      const pending = await prisma.staffAttendance.findMany({
        where: { date: today, checkInAt: { not: null }, checkOutAt: null, checkOutReminderSentAt: null },
        select: {
          id: true,
          schoolId: true,
          staff: { select: { user: { select: { id: true, email: true, firstName: true } } } },
        },
      });
      if (pending.length === 0) return 0;

      const schoolIds = [...new Set(pending.map((p) => p.schoolId))];
      const settingsList = await prisma.staffAttendanceSettings.findMany({ where: { schoolId: { in: schoolIds } } });
      const settingsBySchool = new Map(settingsList.map((s) => [s.schoolId, s]));

      let sent = 0;
      const emails = [];
      for (const row of pending) {
        const windowEnd = settingsBySchool.get(row.schoolId)?.checkOutWindowEnd ?? null;
        const endMinutes = windowEnd ? timeToMinutes(windowEnd) : null;
        const remindAt = endMinutes !== null ? endMinutes - REMINDER_LEAD_MINUTES : DEFAULT_REMINDER_MINUTES;
        if (nowMinutes < remindAt) continue;
        if (endMinutes !== null && nowMinutes > endMinutes) continue;

        const claimed = await prisma.staffAttendance.updateMany({
          where: { id: row.id, checkOutReminderSentAt: null },
          data: { checkOutReminderSentAt: now },
        });
        if (claimed.count === 0) continue;

        const user = row.staff.user;
        const closesAt = endMinutes !== null ? formatMinutes(endMinutes) : null;
        await inAppNotificationService.notify(row.schoolId, user.id, {
          type: "staff_check_out_reminder",
          title: "You haven't checked out yet",
          body: closesAt ? `Check-out closes at ${closesAt}.` : "Remember to check out before you leave.",
          link: "/dashboard/staff-attendance",
        });
        const link = `${process.env.WEB_APP_URL ?? "http://localhost:3000"}/dashboard/staff-attendance`;
        emails.push({ to: user.email, ...checkOutReminderEmail(user.firstName, closesAt, link) });
        sent++;
      }
      await queueEmails(emails);
      return sent;
    });
  },
};
