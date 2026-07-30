import { prisma } from "@sms/db";
import { staffService } from "./staff.service";

const assignmentInclude = {
  class: true,
  section: true,
};

async function getAssignedSectionIds(schoolId: string, staffId: string) {
  const rows = await prisma.teacherAssignment.findMany({
    where: { schoolId, staffId },
    select: { sectionId: true },
  });
  return rows.map((r) => r.sectionId);
}

// Resolves straight from a JWT's userId (req.user.sub) — the routes that need
// this only have the User id on hand, not the Staff row it belongs to.
export async function getAssignedSectionIdsForUser(schoolId: string, userId: string) {
  const staff = await staffService.getByUserId(schoolId, userId);
  if (!staff) return [];
  return getAssignedSectionIds(schoolId, staff.id);
}

// Exams/marks are scoped by class, not section — Subject (and therefore
// ExamSubject) has no section concept, so a teacher assigned to *any*
// section of a class can enter marks for the whole class. There's no
// subject-teacher mapping in this schema to scope it any tighter than that.
export async function getAssignedClassIdsForUser(schoolId: string, userId: string) {
  const staff = await staffService.getByUserId(schoolId, userId);
  if (!staff) return [];
  const rows = await prisma.teacherAssignment.findMany({
    where: { schoolId, staffId: staff.id },
    select: { classId: true },
    distinct: ["classId"],
  });
  return rows.map((r) => r.classId);
}

export const teacherAssignmentService = {
  listForStaff(schoolId: string, staffId: string) {
    return prisma.teacherAssignment.findMany({
      where: { schoolId, staffId },
      include: assignmentInclude,
      orderBy: { createdAt: "asc" },
    });
  },

  // Reverse lookup for the timetable builder's teacher picker — only staff
  // actually assigned to this section should be schedulable in it.
  listForSection(schoolId: string, sectionId: string) {
    return prisma.teacherAssignment.findMany({
      where: { schoolId, sectionId },
      include: { staff: { include: { user: { select: { id: true, firstName: true, lastName: true } } } } },
      orderBy: { createdAt: "asc" },
    });
  },

  getAssignedSectionIds,

  create(schoolId: string, staffId: string, classId: string, sectionId: string) {
    return prisma.teacherAssignment.create({
      data: { schoolId, staffId, classId, sectionId },
      include: assignmentInclude,
    });
  },

  async remove(schoolId: string, staffId: string, sectionId: string) {
    const existing = await prisma.teacherAssignment.findFirst({
      where: { schoolId, staffId, sectionId },
    });
    if (!existing) return null;
    await prisma.teacherAssignment.delete({ where: { id: existing.id } });
    return existing;
  },
};
