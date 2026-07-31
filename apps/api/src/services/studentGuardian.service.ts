import { prisma, GuardianRelationship } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";

export const studentGuardianService = {
  async link(
    schoolId: string,
    studentId: string,
    guardianId: string,
    relationshipType: GuardianRelationship,
    isPrimaryContact = false,
  ) {
    const [student, guardian] = await Promise.all([
      prisma.student.findFirst({ where: { id: studentId, schoolId } }),
      prisma.guardian.findFirst({ where: { id: guardianId, schoolId } }),
    ]);
    if (!student) throw new HttpError(404, "Student not found");
    if (!guardian) throw new HttpError(404, "Guardian not found");

    return prisma.studentGuardian.create({
      data: { schoolId, studentId, guardianId, relationshipType, isPrimaryContact },
    });
  },

  async unlink(schoolId: string, studentId: string, guardianId: string) {
    const link = await prisma.studentGuardian.findFirst({
      where: { schoolId, studentId, guardianId },
    });
    if (!link) return null;
    await prisma.studentGuardian.delete({ where: { id: link.id } });
    return link;
  },

  async isGuardianOfStudent(schoolId: string, guardianUserId: string, studentId: string) {
    const link = await prisma.studentGuardian.findFirst({
      where: { schoolId, studentId, guardian: { userId: guardianUserId } },
    });
    return link !== null;
  },

  async getLinkedClassIds(schoolId: string, guardianUserId: string) {
    const links = await prisma.studentGuardian.findMany({
      where: { schoolId, guardian: { userId: guardianUserId } },
      select: { student: { select: { classId: true } } },
    });
    return [...new Set(links.map((l) => l.student.classId))];
  },

  async getGuardianUserIdsForStudents(schoolId: string, studentIds: string[]) {
    if (!studentIds.length) return [];
    const links = await prisma.studentGuardian.findMany({
      where: { schoolId, studentId: { in: studentIds } },
      select: { guardian: { select: { userId: true } } },
    });
    return [...new Set(links.map((l) => l.guardian.userId))];
  },

  async getChildrenForGuardianUser(schoolId: string, guardianUserId: string) {
    const links = await prisma.studentGuardian.findMany({
      where: { schoolId, guardian: { userId: guardianUserId } },
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            class: { select: { name: true } },
            section: { select: { name: true } },
          },
        },
      },
    });
    return links.map((l) => l.student);
  },
};
