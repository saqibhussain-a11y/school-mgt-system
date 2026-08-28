import { prisma, Role } from "@sms/db";

export const userService = {
  findByEmail(schoolId: string, email: string) {
    return prisma.user.findUnique({
      where: { schoolId_email: { schoolId, email } },
    });
  },

  getById(schoolId: string, id: string) {
    return prisma.user.findFirst({ where: { id, schoolId } });
  },
  
  async updatePassword(schoolId: string, id: string, passwordHash: string) {
    await prisma.user.updateMany({ where: { id, schoolId }, data: { passwordHash, isActivated: true } });
  },

  listByRole(schoolId: string, role: Role) {
    return prisma.user.findMany({
      where: { schoolId, role },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  },
};
