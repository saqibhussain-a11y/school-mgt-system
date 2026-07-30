import { prisma } from "@sms/db";

export const schoolService = {
  getAll() {
    return prisma.school.findMany();
  },

  getById(id: string) {
    return prisma.school.findUnique({ where: { id } });
  },
};
