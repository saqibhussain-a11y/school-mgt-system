import { prisma } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";

export const examTermService = {
  list(schoolId: string, academicSessionId?: string) {
    return prisma.examTerm.findMany({
      where: { schoolId, ...(academicSessionId ? { academicSessionId } : {}) },
      orderBy: { order: "asc" },
    });
  },

  create(schoolId: string, data: { academicSessionId: string; name: string; order: number }) {
    return prisma.examTerm.create({ data: { schoolId, ...data } });
  },

  async update(schoolId: string, id: string, data: { name?: string; order?: number }) {
    const existing = await prisma.examTerm.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    return prisma.examTerm.update({ where: { id }, data });
  },

  // Blocked once an exam links to it — deleting would silently strip the
  // term/rollup linkage off any exam still pointing at this row.
  async remove(schoolId: string, id: string) {
    const existing = await prisma.examTerm.findFirst({
      where: { id, schoolId },
      include: { _count: { select: { exams: true } } },
    });
    if (!existing) return null;
    if (existing._count.exams > 0) {
      throw new HttpError(400, "Cannot delete a term that's already linked to an exam");
    }
    await prisma.examTerm.delete({ where: { id } });
    return existing;
  },
};
