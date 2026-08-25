import { prisma } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";
import { staffService } from "./staff.service";

const syllabusInclude = {
  class: true,
  subject: true,
  academicSession: true,
};

const syllabusDetailInclude = {
  ...syllabusInclude,
  chapters: {
    orderBy: { order: "asc" as const },
    include: { scheduleEntries: { orderBy: { startDate: "asc" as const } } },
  },
};

export const syllabusService = {
  list(
    schoolId: string,
    filters: { academicSessionId?: string; classId?: string; subjectId?: string },
  ) {
    return prisma.syllabus.findMany({
      where: { schoolId, ...filters },
      include: syllabusInclude,
      orderBy: { createdAt: "asc" },
    });
  },

  get(schoolId: string, id: string) {
    return prisma.syllabus.findFirst({
      where: { id, schoolId },
      include: syllabusDetailInclude,
    });
  },

  // Subject is already class-scoped in this schema, so a mismatched pair
  // is a real client error, not just a redundant filter — same check
  // timetableSlotService.assertValidAndConflictFree runs for subject/class.
  async create(
    schoolId: string,
    data: { classId: string; subjectId: string; academicSessionId: string },
  ) {
    const subject = await prisma.subject.findFirst({
      where: { id: data.subjectId, schoolId, classId: data.classId },
    });
    if (!subject) throw new HttpError(400, "Subject not found for this class");

    const existing = await prisma.syllabus.findFirst({
      where: {
        schoolId,
        classId: data.classId,
        subjectId: data.subjectId,
        academicSessionId: data.academicSessionId,
      },
    });
    if (existing) throw new HttpError(409, "A syllabus already exists for this class, subject, and session");

    return prisma.syllabus.create({ data: { schoolId, ...data }, include: syllabusInclude });
  },

  async remove(schoolId: string, id: string) {
    const existing = await prisma.syllabus.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    await prisma.syllabus.delete({ where: { id } });
    return existing;
  },

  // A teacher's own pacing plans — scoped by TeacherSubjectAssignment
  // (teaching capability), the same relation timetableSlotService already
  // gates on, not TeacherAssignment (which is class/section-scoped for
  // attendance and doesn't know about subjects at all).
  async mySyllabus(schoolId: string, userId: string) {
    const staff = await staffService.getByUserId(schoolId, userId);
    if (!staff) return [];
    const subjectIds = (
      await prisma.teacherSubjectAssignment.findMany({
        where: { schoolId, staffId: staff.id },
        select: { subjectId: true },
      })
    ).map((r) => r.subjectId);
    if (subjectIds.length === 0) return [];

    return prisma.syllabus.findMany({
      where: { schoolId, subjectId: { in: subjectIds } },
      include: syllabusInclude,
      orderBy: { createdAt: "asc" },
    });
  },
};
