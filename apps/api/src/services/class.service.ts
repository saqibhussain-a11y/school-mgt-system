import { prisma } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";

export const classService = {
  list(schoolId: string, academicSessionId?: string) {
    return prisma.class.findMany({
      where: { schoolId, ...(academicSessionId ? { academicSessionId } : {}) },
      orderBy: { name: "asc" },
    });
  },

  getById(schoolId: string, id: string) {
    return prisma.class.findFirst({ where: { id, schoolId } });
  },

  async create(schoolId: string, data: { academicSessionId: string; name: string }) {
    const session = await prisma.academicSession.findFirst({
      where: { id: data.academicSessionId, schoolId },
    });
    if (!session) {
      throw new HttpError(400, "Academic session not found");
    }
    return prisma.class.create({ data: { ...data, schoolId } });
  },

  async update(schoolId: string, id: string, data: Partial<{ name: string }>) {
    const existing = await prisma.class.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    return prisma.class.update({ where: { id }, data });
  },

  async remove(schoolId: string, id: string) {
    const existing = await prisma.class.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    return prisma.class.delete({ where: { id } });
  },
};
