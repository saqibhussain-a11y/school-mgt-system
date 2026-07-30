import { prisma } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";

export const sectionService = {
  list(schoolId: string, classId?: string) {
    return prisma.section.findMany({
      where: { schoolId, ...(classId ? { classId } : {}) },
      orderBy: { name: "asc" },
    });
  },

  getById(schoolId: string, id: string) {
    return prisma.section.findFirst({ where: { id, schoolId } });
  },

  async create(schoolId: string, data: { classId: string; name: string }) {
    const cls = await prisma.class.findFirst({ where: { id: data.classId, schoolId } });
    if (!cls) {
      throw new HttpError(400, "Class not found");
    }
    return prisma.section.create({ data: { ...data, schoolId } });
  },

  async update(schoolId: string, id: string, data: Partial<{ name: string }>) {
    const existing = await prisma.section.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    return prisma.section.update({ where: { id }, data });
  },

  async remove(schoolId: string, id: string) {
    const existing = await prisma.section.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    return prisma.section.delete({ where: { id } });
  },
};
