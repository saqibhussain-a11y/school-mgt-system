import { prisma, Role } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";
import { putObject, getDownloadUrl } from "../lib/storage";
import { haversineMeters } from "../lib/geo";
import { staffAttendanceSettingsService } from "./staffAttendanceSettings.service";
import { inAppNotificationService } from "./inAppNotification.service";

const NOTIFY_ROLES: Role[] = [Role.SCHOOL_ADMIN, Role.PRINCIPAL];

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

function todayUtcMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// No school-level timezone concept anywhere in this schema — same
// simplification the rest of the app already makes for date handling
// (holidays, exam dates). The window is compared against the server clock.
function isWithinWindow(start: string | null, end: string | null, now: Date): boolean {
  if (!start || !end) return true;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return nowMinutes >= sh * 60 + sm && nowMinutes <= eh * 60 + em;
}

interface CheckPhoto {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

interface CheckInput {
  lat: number;
  lng: number;
  photo: CheckPhoto;
}

async function computeFlag(schoolId: string, lat: number, lng: number) {
  const settings = await staffAttendanceSettingsService.getOrCreate(schoolId);
  if (settings.officeLat === null || settings.officeLng === null) return false;
  const distance = haversineMeters(lat, lng, settings.officeLat, settings.officeLng);
  return distance > settings.radiusMeters;
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

export const staffAttendanceService = {
  async checkIn(schoolId: string, staffId: string, input: CheckInput) {
    const settings = await staffAttendanceSettingsService.getOrCreate(schoolId);
    const now = new Date();
    if (!isWithinWindow(settings.checkInWindowStart, settings.checkInWindowEnd, now)) {
      throw new HttpError(
        400,
        `Check-in is only allowed between ${settings.checkInWindowStart} and ${settings.checkInWindowEnd}`,
      );
    }

    const date = todayUtcMidnight();
    const existing = await prisma.staffAttendance.findUnique({
      where: { staffId_date: { staffId, date } },
    });
    if (existing?.checkInAt) {
      throw new HttpError(409, "Already checked in today");
    }

    const flagged = await computeFlag(schoolId, input.lat, input.lng);
    const key = `schools/${schoolId}/staff-attendance/${staffId}/${date.toISOString().slice(0, 10)}-in-${Date.now()}-${sanitizeFilename(input.photo.filename)}`;
    await putObject(key, input.photo.buffer, input.photo.contentType);

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
    if (!isWithinWindow(settings.checkOutWindowStart, settings.checkOutWindowEnd, now)) {
      throw new HttpError(
        400,
        `Check-out is only allowed between ${settings.checkOutWindowStart} and ${settings.checkOutWindowEnd}`,
      );
    }

    const date = todayUtcMidnight();
    const existing = await prisma.staffAttendance.findUnique({
      where: { staffId_date: { staffId, date } },
    });
    if (!existing?.checkInAt) {
      throw new HttpError(400, "Check in before checking out");
    }
    if (existing.checkOutAt) {
      throw new HttpError(409, "Already checked out today");
    }

    const flagged = await computeFlag(schoolId, input.lat, input.lng);
    const key = `schools/${schoolId}/staff-attendance/${staffId}/${date.toISOString().slice(0, 10)}-out-${Date.now()}-${sanitizeFilename(input.photo.filename)}`;
    await putObject(key, input.photo.buffer, input.photo.contentType);

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
      where: { staffId_date: { staffId, date: todayUtcMidnight() } },
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

  // A full roster for one day — every ACTIVE staff member, whether or not
  // they've checked in yet, not just the rows that happen to exist. Prisma
  // has no clean "outer join with filter" for this shape, so fetch both
  // lists and merge in JS.
  async getRosterForDate(schoolId: string, date: Date) {
    const [staff, rows] = await Promise.all([
      prisma.staff.findMany({
        where: { schoolId, status: "ACTIVE" },
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { user: { firstName: "asc" } },
      }),
      prisma.staffAttendance.findMany({ where: { schoolId, date } }),
    ]);
    const rowByStaffId = new Map(rows.map((r) => [r.staffId, r]));

    return Promise.all(
      staff.map(async (s) => {
        const row = rowByStaffId.get(s.id);
        return {
          staffId: s.id,
          firstName: s.user.firstName,
          lastName: s.user.lastName,
          checkInAt: row?.checkInAt ?? null,
          checkInFlagged: row?.checkInFlagged ?? false,
          checkInPhotoUrl: row?.checkInPhotoKey ? await getDownloadUrl(row.checkInPhotoKey) : null,
          checkOutAt: row?.checkOutAt ?? null,
          checkOutFlagged: row?.checkOutFlagged ?? false,
          checkOutPhotoUrl: row?.checkOutPhotoKey ? await getDownloadUrl(row.checkOutPhotoKey) : null,
        };
      }),
    );
  },
};
