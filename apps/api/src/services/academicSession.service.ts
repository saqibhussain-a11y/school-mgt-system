import { prisma } from "@sms/db";

export const academicSessionService = {
  list(schoolId: string) {
    return prisma.academicSession.findMany({
      where: { schoolId },
      orderBy: { startDate: "desc" },
    });
  },

  getById(schoolId: string, id: string) {
    return prisma.academicSession.findFirst({ where: { id, schoolId } });
  },

  create(schoolId: string, data: { name: string; startDate: Date; endDate: Date }) {
    return prisma.academicSession.create({ data: { ...data, schoolId } });
  },

  async update(
    schoolId: string,
    id: string,
    data: Partial<{ name: string; startDate: Date; endDate: Date; isActive: boolean }>,
  ) {
    const existing = await prisma.academicSession.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    return prisma.academicSession.update({ where: { id }, data });
  },

  async remove(schoolId: string, id: string) {
    const existing = await prisma.academicSession.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    return prisma.academicSession.delete({ where: { id } });
  },
};
