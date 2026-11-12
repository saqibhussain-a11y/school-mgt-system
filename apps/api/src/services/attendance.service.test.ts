import { describe, expect, it } from "vitest";
import { AttendanceStatus, DayOfWeek, GuardianRelationship, prisma, Role } from "@sms/db";
import { attendanceService } from "./attendance.service";
import { addDays, parseDateKey, schoolToday } from "../lib/schoolTime";
import { createTestClassSection, createTestSchool, createTestStudent, createTestUser, withTenant } from "../test/helpers";

const MONDAY = parseDateKey("2026-11-09")!;
const SATURDAY = parseDateKey("2026-11-07")!;
const SUNDAY = parseDateKey("2026-11-08")!;

async function setup() {
  const schoolId = await createTestSchool();
  const { classId, sectionId } = await createTestClassSection(schoolId);
  const student = await createTestStudent(schoolId, classId, sectionId);
  const parent = await createTestUser(schoolId, Role.PARENT);
  const teacher = await createTestUser(schoolId, Role.TEACHER);
  await withTenant(schoolId, async () => {
    const guardian = await prisma.guardian.create({ data: { schoolId, userId: parent.id } });
    await prisma.studentGuardian.create({
      data: { schoolId, studentId: student.id, guardianId: guardian.id, relationshipType: GuardianRelationship.MOTHER },
    });
  });

  const mark = (status: AttendanceStatus, date = MONDAY, remarks?: string) =>
    withTenant(schoolId, () =>
      attendanceService.markBulk(schoolId, {
        classId,
        sectionId,
        date,
        markedByUserId: teacher.id,
        records: [{ studentId: student.id, status, remarks }],
      }),
    );
  const parentAlerts = () =>
    withTenant(schoolId, () =>
      prisma.notification.findMany({
        where: { schoolId, userId: parent.id, type: "attendance" },
        orderBy: { createdAt: "asc" },
      }),
    );
  return { schoolId, mark, parentAlerts };
}

describe("attendanceService.markBulk — which days can be marked", () => {
  it("rejects a future date", async () => {
    const s = await setup();
    await expect(s.mark(AttendanceStatus.PRESENT, addDays(schoolToday(), 1))).rejects.toThrow("future date");
  });

  it("rejects Sunday", async () => {
    const s = await setup();
    await expect(s.mark(AttendanceStatus.PRESENT, SUNDAY)).rejects.toThrow("isn't a school day");
  });

  it("rejects a day the school has switched off, and accepts it again once switched on", async () => {
    const s = await setup();
    await withTenant(s.schoolId, () =>
      prisma.school.update({
        where: { id: s.schoolId },
        data: {
          workingDays: [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY],
        },
      }),
    );
    await expect(s.mark(AttendanceStatus.PRESENT, SATURDAY)).rejects.toThrow("isn't a school day");

    await withTenant(s.schoolId, () =>
      prisma.school.update({ where: { id: s.schoolId }, data: { workingDays: { push: DayOfWeek.SATURDAY } } }),
    );
    await expect(s.mark(AttendanceStatus.PRESENT, SATURDAY)).resolves.toBeTruthy();
  });

  it("rejects a holiday", async () => {
    const s = await setup();
    await withTenant(s.schoolId, () =>
      prisma.holiday.create({ data: { schoolId: s.schoolId, date: MONDAY, name: "Iqbal Day" } }),
    );
    await expect(s.mark(AttendanceStatus.PRESENT)).rejects.toThrow("Iqbal Day");
  });
});

describe("attendanceService.markBulk — parent alerts", () => {
  it("doesn't alert parents for Present or Leave", async () => {
    const s = await setup();
    expect((await s.mark(AttendanceStatus.PRESENT)).parentsNotified).toBe(0);
    expect((await s.mark(AttendanceStatus.LEAVE, parseDateKey("2026-11-10")!)).parentsNotified).toBe(0);
    expect(await s.parentAlerts()).toHaveLength(0);
  });

  it("alerts parents once when marked absent, with the teacher's remark", async () => {
    const s = await setup();
    expect((await s.mark(AttendanceStatus.ABSENT, MONDAY, "No call from home")).parentsNotified).toBe(1);
    expect((await s.mark(AttendanceStatus.ABSENT, MONDAY, "No call from home")).parentsNotified).toBe(0);

    const alerts = await s.parentAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].title).toContain("marked absent");
    expect(alerts[0].body).toContain("No call from home");
  });

  it("sends a correction when an absent mark is changed to present", async () => {
    const s = await setup();
    await s.mark(AttendanceStatus.ABSENT);
    expect((await s.mark(AttendanceStatus.PRESENT)).parentsNotified).toBe(1);

    const alerts = await s.parentAlerts();
    expect(alerts.map((a) => a.title)).toEqual([
      expect.stringContaining("marked absent"),
      expect.stringContaining("Attendance corrected"),
    ]);
  });

  it("alerts on half day too", async () => {
    const s = await setup();
    expect((await s.mark(AttendanceStatus.HALF_DAY)).parentsNotified).toBe(1);
    expect((await s.parentAlerts())[0].title).toContain("half day");
  });
});
