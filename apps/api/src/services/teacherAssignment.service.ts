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

export const teacherAssignmentService = {
  listForStaff(schoolId: string, staffId: string) {
    return prisma.teacherAssignment.findMany({
      where: { schoolId, staffId },
      include: assignmentInclude,
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
