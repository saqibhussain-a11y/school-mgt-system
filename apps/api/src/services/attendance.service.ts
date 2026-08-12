import { prisma, AttendanceStatus } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";
import { holidayService } from "./holiday.service";

export interface MarkAttendanceRecord {
  studentId: string;
  status: AttendanceStatus;
  remarks?: string;
}

const STATUS_WEIGHT: Record<AttendanceStatus, number> = {
  PRESENT: 1,
  HALF_DAY: 0.5,
  ABSENT: 0,
  LEAVE: 0,
};

export const attendanceService = {
  async markBulk(
    schoolId: string,
    input: {
      classId: string;
      sectionId: string;
      date: Date;
      markedByUserId: string;
      records: MarkAttendanceRecord[];
    },
  ) {
    const holiday = await holidayService.isHoliday(schoolId, input.date);
    if (holiday) {
      throw new HttpError(400, `Cannot mark attendance on a holiday (${holiday.name})`);
    }

    const section = await prisma.section.findFirst({
      where: { id: input.sectionId, schoolId, classId: input.classId },
    });
    if (!section) {
      throw new HttpError(400, "Section not found for this class");
    }

    const studentIds = input.records.map((r) => r.studentId);
    const validStudents = await prisma.student.findMany({
      where: { id: { in: studentIds }, schoolId, classId: input.classId, sectionId: input.sectionId },
      select: { id: true },
    });
    const validIds = new Set(validStudents.map((s) => s.id));
    const invalid = studentIds.filter((id) => !validIds.has(id));
    if (invalid.length > 0) {
      throw new HttpError(400, `These students are not in this class/section: ${invalid.join(", ")}`);
    }

    return prisma.$transaction(
      input.records.map((record) =>
        prisma.attendance.upsert({
          where: { studentId_date: { studentId: record.studentId, date: input.date } },
          create: {
            schoolId,
            studentId: record.studentId,
            classId: input.classId,
            sectionId: input.sectionId,
            date: input.date,
            status: record.status,
            remarks: record.remarks,
            markedByUserId: input.markedByUserId,
          },
          update: {
            status: record.status,
            remarks: record.remarks,
            markedByUserId: input.markedByUserId,
          },
        }),
      ),
    );
  },

  getByClassSectionDate(schoolId: string, classId: string, sectionId: string, date: Date) {
    return prisma.attendance.findMany({
      where: { schoolId, classId, sectionId, date },
      include: {
        student: {
          include: { user: { select: { firstName: true, lastName: true, email: true } } },
        },
      },
      orderBy: { student: { admissionNo: "asc" } },
    });
  },

  // Not real pagination — "All time" is a deliberate, named preset on the
  // student attendance card (see the Attendance viewing feature), so this
  // can't silently cap at some small page size without breaking that
  // feature's own point. The cap here is a backstop against a pathological
  // case only, comfortably above any real multi-year daily-attendance
  // history (10 school years of every day, weekends included).
  getHistoryForStudent(schoolId: string, studentId: string, from?: Date, to?: Date) {
    return prisma.attendance.findMany({
      where: {
        schoolId,
        studentId,
        ...(from || to ? { date: { gte: from, lte: to } } : {}),
      },
      orderBy: { date: "desc" },
      take: 3650,
    });
  },

  // Pushed into Postgres as a GROUP BY instead of pulling every attendance
  // row into Node just to count them — was `select: { status: true }` over
  // the full row set, reduced in JS.
  async getSummaryForStudent(schoolId: string, studentId: string, from?: Date, to?: Date) {
    const groups = await prisma.attendance.groupBy({
      by: ["status"],
      where: {
        schoolId,
        studentId,
        ...(from || to ? { date: { gte: from, lte: to } } : {}),
      },
      _count: { _all: true },
    });

    let totalDays = 0;
    let presentEquivalent = 0;
    const breakdown = {} as Record<AttendanceStatus, number>;
    for (const g of groups) {
      breakdown[g.status] = g._count._all;
      totalDays += g._count._all;
      presentEquivalent += STATUS_WEIGHT[g.status] * g._count._all;
    }
    const percentage = totalDays > 0 ? Math.round((presentEquivalent / totalDays) * 10000) / 100 : 0;

    return { totalDays, percentage, breakdown };
  },

  // Per-student % + breakdown for a whole class/section over a date range —
  // the "weekly/monthly for the class" view the day-by-day mark/view tab
  // doesn't provide. Grouped by Postgres (studentId, status), not by pulling
  // every attendance row in range into Node — a class over a school year
  // collapses to a handful of grouped rows per student instead of one row
  // per school day per student.
  async getClassSectionRangeSummary(
    schoolId: string,
    classId: string,
    sectionId: string,
    from?: Date,
    to?: Date,
  ) {
    const students = await prisma.student.findMany({
      where: { schoolId, classId, sectionId, status: "ACTIVE" },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { admissionNo: "asc" },
    });

    const groups = await prisma.attendance.groupBy({
      by: ["studentId", "status"],
      where: {
        schoolId,
        classId,
        sectionId,
        ...(from || to ? { date: { gte: from, lte: to } } : {}),
      },
      _count: { _all: true },
    });

    const breakdownByStudent = new Map<string, Record<AttendanceStatus, number>>();
    for (const g of groups) {
      const breakdown = breakdownByStudent.get(g.studentId) ?? ({} as Record<AttendanceStatus, number>);
      breakdown[g.status] = g._count._all;
      breakdownByStudent.set(g.studentId, breakdown);
    }

    return students.map((student) => {
      const breakdown = breakdownByStudent.get(student.id) ?? ({} as Record<AttendanceStatus, number>);
      let totalDays = 0;
      let presentEquivalent = 0;
      for (const [status, count] of Object.entries(breakdown) as [AttendanceStatus, number][]) {
        totalDays += count;
        presentEquivalent += STATUS_WEIGHT[status] * count;
      }
      const percentage = totalDays > 0 ? Math.round((presentEquivalent / totalDays) * 10000) / 100 : 0;
      return {
        studentId: student.id,
        admissionNo: student.admissionNo,
        firstName: student.user.firstName,
        lastName: student.user.lastName,
        totalDays,
        percentage,
        breakdown,
      };
    });
  },

  // Called on every staff dashboard load — was a full unfiltered table scan
  // reduced in JS, now a Postgres GROUP BY that returns at most 4 rows
  // (one per AttendanceStatus) regardless of how many attendance records
  // the school has accumulated.
  async getSchoolSummary(schoolId: string, from?: Date, to?: Date) {
    const groups = await prisma.attendance.groupBy({
      by: ["status"],
      where: { schoolId, ...(from || to ? { date: { gte: from, lte: to } } : {}) },
      _count: { _all: true },
    });

    let totalMarked = 0;
    let presentEquivalent = 0;
    for (const g of groups) {
      totalMarked += g._count._all;
      presentEquivalent += STATUS_WEIGHT[g.status] * g._count._all;
    }
    const percentage = totalMarked > 0 ? Math.round((presentEquivalent / totalMarked) * 10000) / 100 : 0;

    return { totalMarked, percentage };
  },
};
