import { prisma } from "@sms/db";

const assignmentInclude = {
  subject: { include: { class: { select: { id: true, name: true } } } },
};

// Which subjects a teacher is qualified to teach — deliberately separate
// from teacherAssignment.service.ts (attendance-scoping), see schema comment
// on TeacherSubjectAssignment. This is the model the timetable generator
// reads to pick a qualified teacher for a (section, subject) pair.
export const teacherSubjectAssignmentService = {
  listForStaff(schoolId: string, staffId: string) {
    return prisma.teacherSubjectAssignment.findMany({
      where: { schoolId, staffId },
      include: assignmentInclude,
      orderBy: { createdAt: "asc" },
    });
  },

  // Reverse lookup for the generator: who's qualified to teach this subject.
  listForSubject(schoolId: string, subjectId: string) {
    return prisma.teacherSubjectAssignment.findMany({
      where: { schoolId, subjectId },
      include: { staff: { include: { user: { select: { id: true, firstName: true, lastName: true } } } } },
    });
  },

  // One admin action ("Ms. Smith teaches Math for Grades 4/5/6") maps to
  // several rows (Subject is per-Class) — created in one transaction so it's
  // atomic, mirroring feeInvoiceService.generate's bulk-create pattern.
  // Existing rows for subjectIds already assigned are left untouched.
  async createBulk(schoolId: string, staffId: string, subjectIds: string[]) {
    const existing = await prisma.teacherSubjectAssignment.findMany({
      where: { schoolId, staffId, subjectId: { in: subjectIds } },
      select: { subjectId: true },
    });
    const existingIds = new Set(existing.map((e) => e.subjectId));
    const toCreate = subjectIds.filter((id) => !existingIds.has(id));

    await prisma.$transaction(
      toCreate.map((subjectId) =>
        prisma.teacherSubjectAssignment.create({ data: { schoolId, staffId, subjectId } }),
      ),
    );
    return teacherSubjectAssignmentService.listForStaff(schoolId, staffId);
  },

  async remove(schoolId: string, staffId: string, subjectId: string) {
    const existing = await prisma.teacherSubjectAssignment.findFirst({
      where: { schoolId, staffId, subjectId },
    });
    if (!existing) return null;
    await prisma.teacherSubjectAssignment.delete({ where: { id: existing.id } });
    return existing;
  },
};
