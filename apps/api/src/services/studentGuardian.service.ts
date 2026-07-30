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
};
