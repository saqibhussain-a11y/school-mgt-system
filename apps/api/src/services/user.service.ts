import { prisma, Role } from "@sms/db";

export const userService = {
  findByEmail(schoolId: string, email: string) {
    return prisma.user.findUnique({
      where: { schoolId_email: { schoolId, email } },
    });
  },

  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  create(data: { schoolId: string; email: string; passwordHash: string; role: Role }) {
    return prisma.user.create({ data });
  },

  updatePassword(id: string, passwordHash: string) {
    return prisma.user.update({ where: { id }, data: { passwordHash } });
  },
};
