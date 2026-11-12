import { describe, expect, it } from "vitest";
import { DayOfWeek, LeaveStatus, prisma, Role } from "@sms/db";
import { evaluateLocation, staffAttendanceService, staffDayStatus } from "./staffAttendance.service";
import { staffAttendanceSettingsService } from "./staffAttendanceSettings.service";
import { parseDateKey, schoolToday } from "../lib/schoolTime";
import { createTestSchool, createTestStaff, withTenant } from "../test/helpers";

const OFFICE = { lat: 31.5204, lng: 74.3587 }; // Lahore
const NEARBY = { lat: 31.5208, lng: 74.3589 }; // ~50 m away
const FAR = { lat: 31.5304, lng: 74.3587 }; // ~1.1 km away
const photo = { buffer: Buffer.from(""), ext: ".jpg" };

const ALL_DAYS = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
];

describe("evaluateLocation — flag vs block outside the office radius", () => {
  async function schoolWithOffice(blockOutsideRadius: boolean) {
    const schoolId = await createTestSchool();
    await withTenant(schoolId, () =>
      staffAttendanceSettingsService.update(schoolId, {
        officeLat: OFFICE.lat,
        officeLng: OFFICE.lng,
        radiusMeters: 200,
        blockOutsideRadius,
      }),
    );
    return schoolId;
  }

  it("accepts a check-in inside the radius in either mode", async () => {
    for (const block of [false, true]) {
      const schoolId = await schoolWithOffice(block);
      const result = await withTenant(schoolId, () => evaluateLocation(schoolId, { ...NEARBY, photo }, "check in"));
      expect(result.flagged).toBe(false);
    }
  });

  it("flags but accepts an out-of-range check-in by default", async () => {
    const schoolId = await schoolWithOffice(false);
    const result = await withTenant(schoolId, () => evaluateLocation(schoolId, { ...FAR, photo }, "check in"));
    expect(result.flagged).toBe(true);
  });

  it("refuses an out-of-range check-in when blocking is on, saying how far away they are", async () => {
    const schoolId = await schoolWithOffice(true);
    await expect(
      withTenant(schoolId, () => evaluateLocation(schoolId, { ...FAR, photo }, "check in")),
    ).rejects.toThrow(/about 1\d{3} m from school.*within 200 m/);
  });

  it("tells the user when their phone's GPS is too imprecise", async () => {
    const schoolId = await schoolWithOffice(true);
    await expect(
      withTenant(schoolId, () => evaluateLocation(schoolId, { ...FAR, accuracy: 900, photo }, "check out")),
    ).rejects.toThrow("accurate to about ±900 m");
  });

  it("does nothing when the school hasn't set an office location", async () => {
    const schoolId = await createTestSchool();
    const result = await withTenant(schoolId, () => evaluateLocation(schoolId, { ...FAR, photo }, "check in"));
    expect(result.flagged).toBe(false);
  });
});

describe("staffDayStatus", () => {
  const today = parseDateKey("2026-11-12")!; // Thursday
  const base = {
    today,
    nowMinutes: 10 * 60,
    schoolWorkingDays: ALL_DAYS,
    holiday: false,
    checkInWindowEnd: "09:00",
  };
  const staff = { workingDays: ALL_DAYS, joinedOn: parseDateKey("2026-01-01")! };
  const monday = parseDateKey("2026-11-09")!;

  it("covers every status", () => {
    expect(staffDayStatus({ ...base, date: monday }, staff, true, false)).toBe("PRESENT");
    expect(staffDayStatus({ ...base, date: monday }, staff, false, false)).toBe("ABSENT");
    expect(staffDayStatus({ ...base, date: monday }, staff, false, true)).toBe("ON_LEAVE");
    expect(staffDayStatus({ ...base, date: monday, holiday: true }, staff, false, false)).toBe("HOLIDAY");
    expect(staffDayStatus({ ...base, date: parseDateKey("2026-11-08")! }, staff, false, false)).toBe("OFF_DAY");
    expect(staffDayStatus({ ...base, date: parseDateKey("2026-11-13")! }, staff, false, false)).toBe("UPCOMING");
    expect(
      staffDayStatus({ ...base, date: monday }, { ...staff, joinedOn: parseDateKey("2026-11-10")! }, false, false),
    ).toBe("NOT_JOINED");
  });

  it("treats a part-time teacher's non-working day as an off day, not an absence", () => {
    const partTime = { ...staff, workingDays: [DayOfWeek.TUESDAY, DayOfWeek.THURSDAY] };
    expect(staffDayStatus({ ...base, date: monday }, partTime, false, false)).toBe("OFF_DAY");
  });

  it("only counts today as absent once the check-in window has closed", () => {
    expect(staffDayStatus({ ...base, date: today, nowMinutes: 8 * 60 }, staff, false, false)).toBe("PENDING");
    expect(staffDayStatus({ ...base, date: today, nowMinutes: 9 * 60 + 1 }, staff, false, false)).toBe("ABSENT");
    expect(staffDayStatus({ ...base, date: today, checkInWindowEnd: null }, staff, false, false)).toBe("PENDING");
  });
});

describe("staff roster and monthly report", () => {
  async function setup() {
    const schoolId = await createTestSchool();
    const [present, onLeave, absent] = await Promise.all([
      createTestStaff(schoolId),
      createTestStaff(schoolId),
      createTestStaff(schoolId),
    ]);
    await withTenant(schoolId, async () => {
      await prisma.staff.updateMany({ where: { schoolId }, data: { joiningDate: new Date("2026-01-01T00:00:00Z") } });
      const leaveUser = await prisma.staff.findUniqueOrThrow({ where: { id: onLeave.id }, select: { userId: true } });
      await prisma.leaveRequest.create({
        data: {
          schoolId,
          userId: leaveUser.userId,
          role: Role.TEACHER,
          leaveType: "SICK",
          startDate: parseDateKey("2026-10-05")!,
          endDate: parseDateKey("2026-10-09")!,
          reason: "Flu",
          status: LeaveStatus.APPROVED,
        },
      });
      // Present every October school day except the 6th, never checked out on the 7th.
      for (let day = 1; day <= 31; day++) {
        const date = parseDateKey(`2026-10-${String(day).padStart(2, "0")}`)!;
        if (date.getUTCDay() === 0 || day === 6) continue;
        await prisma.staffAttendance.create({
          data: {
            schoolId,
            staffId: present.id,
            date,
            checkInAt: new Date(date.getTime() + 3 * 3600_000),
            checkOutAt: day === 7 ? null : new Date(date.getTime() + 9 * 3600_000),
            checkInFlagged: day === 8,
          },
        });
      }
      await prisma.holiday.create({ data: { schoolId, date: parseDateKey("2026-10-20")!, name: "Test holiday" } });
    });
    return { schoolId, present, onLeave, absent };
  }

  it("shows every staff member's status for a past day", async () => {
    const s = await setup();
    const roster = await withTenant(s.schoolId, () =>
      staffAttendanceService.getRosterForDate(s.schoolId, parseDateKey("2026-10-07")!),
    );
    const byId = new Map(roster.map((r) => [r.staffId, r]));
    expect(byId.get(s.present.id)).toMatchObject({ status: "PRESENT", missedCheckOut: true });
    expect(byId.get(s.onLeave.id)?.status).toBe("ON_LEAVE");
    expect(byId.get(s.absent.id)?.status).toBe("ABSENT");
  });

  it("totals a month: school days exclude Sundays and holidays", async () => {
    const s = await setup();
    const report = await withTenant(s.schoolId, () =>
      staffAttendanceService.getMonthlyReport(s.schoolId, 2026, 10, new Date("2026-11-12T06:00:00Z")),
    );
    // October 2026: 31 days − 4 Sundays − 1 holiday
    expect(report.schoolDays).toBe(26);
    const byId = new Map(report.staff.map((r) => [r.staffId, r]));

    // checked in on 26 non-Sunday days minus the 6th = 26 (incl. the holiday, which still counts as present)
    expect(byId.get(s.present.id)).toMatchObject({ present: 26, absent: 1, onLeave: 0, flagged: 1, missedCheckOut: 1 });
    expect(byId.get(s.onLeave.id)).toMatchObject({ present: 0, onLeave: 5, absent: 21 });
    expect(byId.get(s.absent.id)).toMatchObject({ present: 0, onLeave: 0, absent: 26, attendancePercentage: 0 });
  });
});

describe("staffAttendanceService.sendCheckOutReminders", () => {
  it("reminds once, 30 minutes before the check-out window closes", async () => {
    const schoolId = await createTestSchool();
    const staff = await createTestStaff(schoolId);
    // 14:45 PKT = 09:45 UTC
    const now = new Date("2031-03-03T09:45:00Z");
    await withTenant(schoolId, async () => {
      await staffAttendanceSettingsService.update(schoolId, { checkOutWindowStart: "13:00", checkOutWindowEnd: "15:00" });
      await prisma.staffAttendance.create({
        data: { schoolId, staffId: staff.id, date: schoolToday(now), checkInAt: new Date("2031-03-03T03:00:00Z") },
      });
    });
    const reminders = () =>
      withTenant(schoolId, () =>
        prisma.notification.count({ where: { userId: staff.userId, type: "staff_check_out_reminder" } }),
      );

    await staffAttendanceService.sendCheckOutReminders(new Date("2031-03-03T09:00:00Z")); // 14:00, too early
    expect(await reminders()).toBe(0);

    await staffAttendanceService.sendCheckOutReminders(now);
    await staffAttendanceService.sendCheckOutReminders(new Date("2031-03-03T09:50:00Z"));
    expect(await reminders()).toBe(1);
  });

  it("doesn't remind someone who already checked out", async () => {
    const schoolId = await createTestSchool();
    const staff = await createTestStaff(schoolId);
    const now = new Date("2031-03-04T11:30:00Z"); // 16:30 PKT, past the 4 PM default
    await withTenant(schoolId, () =>
      prisma.staffAttendance.create({
        data: {
          schoolId,
          staffId: staff.id,
          date: schoolToday(now),
          checkInAt: new Date("2031-03-04T03:00:00Z"),
          checkOutAt: new Date("2031-03-04T10:00:00Z"),
        },
      }),
    );
    await staffAttendanceService.sendCheckOutReminders(now);
    const count = await withTenant(schoolId, () =>
      prisma.notification.count({ where: { userId: staff.userId, type: "staff_check_out_reminder" } }),
    );
    expect(count).toBe(0);
  });
});
