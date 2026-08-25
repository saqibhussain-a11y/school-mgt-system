import { prisma, Role, runAsPlatform } from "@sms/db";

export const userService = {
  findByEmail(schoolId: string, email: string) {
    return prisma.user.findUnique({
      where: { schoolId_email: { schoolId, email } },
    });
  },

  // Platform-only lookup — there is exactly one super admin system-wide, so
  // this searches across every tenant by email/role instead of a schoolId.
  findSuperAdminByEmail(email: string) {
    return runAsPlatform(() => prisma.user.findFirst({ where: { email, role: Role.SUPER_ADMIN } }));
  },

  getById(schoolId: string, id: string) {
    return prisma.user.findFirst({ where: { id, schoolId } });
  },

  create(data: {
    schoolId: string;
    email: string;
    passwordHash: string;
    role: Role;
    firstName?: string;
    lastName?: string;
  }) {
    return prisma.user.create({ data });
  },

  // Also activates the account — a real password only ever gets set here
  // once someone (admin or the user via OTP) has legitimately claimed it, so
  // this is always the correct moment to lift isActivated, including for
  // already-active users where it's a harmless no-op overwrite.
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
