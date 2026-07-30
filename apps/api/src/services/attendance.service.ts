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

  getHistoryForStudent(schoolId: string, studentId: string, from?: Date, to?: Date) {
    return prisma.attendance.findMany({
      where: {
        schoolId,
        studentId,
        ...(from || to ? { date: { gte: from, lte: to } } : {}),
      },
      orderBy: { date: "desc" },
    });
  },

  async getSummaryForStudent(schoolId: string, studentId: string, from?: Date, to?: Date) {
    const records = await prisma.attendance.findMany({
      where: {
        schoolId,
        studentId,
        ...(from || to ? { date: { gte: from, lte: to } } : {}),
      },
      select: { status: true },
    });

    const totalDays = records.length;
    const presentEquivalent = records.reduce((sum, r) => sum + STATUS_WEIGHT[r.status], 0);
    const percentage = totalDays > 0 ? Math.round((presentEquivalent / totalDays) * 10000) / 100 : 0;

    const breakdown = records.reduce(
      (acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<AttendanceStatus, number>,
    );

    return { totalDays, percentage, breakdown };
  },

  // Per-student % + breakdown for a whole class/section over a date range —
  // the "weekly/monthly for the class" view the day-by-day mark/view tab
  // doesn't provide. One query for all attendance rows in range, grouped in
  // JS, rather than one getSummaryForStudent query per student.
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

    const records = await prisma.attendance.findMany({
      where: {
        schoolId,
        classId,
        sectionId,
        ...(from || to ? { date: { gte: from, lte: to } } : {}),
      },
      select: { studentId: true, status: true },
    });

    const statusesByStudent = new Map<string, AttendanceStatus[]>();
    for (const record of records) {
      const list = statusesByStudent.get(record.studentId) ?? [];
      list.push(record.status);
      statusesByStudent.set(record.studentId, list);
    }

    return students.map((student) => {
      const statuses = statusesByStudent.get(student.id) ?? [];
      const totalDays = statuses.length;
      const presentEquivalent = statuses.reduce((sum, s) => sum + STATUS_WEIGHT[s], 0);
      const percentage = totalDays > 0 ? Math.round((presentEquivalent / totalDays) * 10000) / 100 : 0;
      const breakdown = statuses.reduce(
        (acc, s) => {
          acc[s] = (acc[s] ?? 0) + 1;
          return acc;
        },
        {} as Record<AttendanceStatus, number>,
      );
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

  async getSchoolSummary(schoolId: string, from?: Date, to?: Date) {
    const records = await prisma.attendance.findMany({
      where: { schoolId, ...(from || to ? { date: { gte: from, lte: to } } : {}) },
      select: { status: true },
    });

    const totalMarked = records.length;
    const presentEquivalent = records.reduce((sum, r) => sum + STATUS_WEIGHT[r.status], 0);
    const percentage =
      totalMarked > 0 ? Math.round((presentEquivalent / totalMarked) * 10000) / 100 : 0;

    return { totalMarked, percentage };
  },
};
