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
};
