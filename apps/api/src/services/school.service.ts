import { prisma, Role, runAsPlatform } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";
import { hashPassword } from "../lib/password";
import { generateTempPassword } from "../lib/tempPassword";
import { notificationService } from "./notification.service";
import { userService } from "./user.service";
import { authTokenService } from "./authToken.service";

export const schoolService = {
  listForLogin() {
    return prisma.school.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  },

  listForPlatform() {
    return runAsPlatform(() => prisma.school.findMany({ orderBy: { createdAt: "desc" } }));
  },

  async create(data: {
    name: string;
    subdomain: string;
    adminEmail: string;
    adminFirstName: string;
    adminLastName: string;
  }) {
    return runAsPlatform(async () => {
      const existing = await prisma.school.findUnique({ where: { subdomain: data.subdomain } });
      if (existing) throw new HttpError(409, "A school with this subdomain already exists");

      const temporaryPassword = generateTempPassword();
      const passwordHash = await hashPassword(temporaryPassword);

      const school = await prisma.$transaction(async (tx) => {
        const created = await tx.school.create({ data: { name: data.name, subdomain: data.subdomain } });
        await tx.user.create({
          data: {
            schoolId: created.id,
            email: data.adminEmail,
            passwordHash,
            role: Role.SCHOOL_ADMIN,
            firstName: data.adminFirstName,
            lastName: data.adminLastName,
          },
        });
        return created;
      });

      await notificationService.notifyNewAccount(data.adminEmail, data.adminFirstName, temporaryPassword);
      return { ...school, adminEmail: data.adminEmail, adminTemporaryPassword: temporaryPassword };
    });
  },

  async updateSubscription(id: string, data: { subscriptionStatus?: string; subscriptionPlan?: string }) {
    return runAsPlatform(async () => {
      const existing = await prisma.school.findUnique({ where: { id } });
      if (!existing) return null;
      return prisma.school.update({ where: { id }, data });
    });
  },

  getAdmins(schoolId: string) {
    return runAsPlatform(() => userService.listByRole(schoolId, Role.SCHOOL_ADMIN));
  },

  async createAdmin(schoolId: string, data: { email: string; firstName: string; lastName: string }) {
    return runAsPlatform(async () => {
      const school = await prisma.school.findUnique({ where: { id: schoolId } });
      if (!school) throw new HttpError(404, "School not found");

      const existing = await prisma.user.findUnique({
        where: { schoolId_email: { schoolId, email: data.email } },
      });
      if (existing) throw new HttpError(409, "A user with this email already exists at this school");

      const temporaryPassword = generateTempPassword();
      const passwordHash = await hashPassword(temporaryPassword);
      const admin = await prisma.user.create({
        data: {
          schoolId,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          passwordHash,
          role: Role.SCHOOL_ADMIN,
        },
      });

      await notificationService.notifyNewAccount(data.email, data.firstName, temporaryPassword);
      return { id: admin.id, email: admin.email, firstName: admin.firstName, lastName: admin.lastName };
    });
  },

  async resetAdminPassword(schoolId: string, adminId: string) {
    return runAsPlatform(async () => {
      const admin = await prisma.user.findFirst({
        where: { id: adminId, schoolId, role: Role.SCHOOL_ADMIN },
      });
      if (!admin) throw new HttpError(404, "Admin not found at this school");

      const temporaryPassword = generateTempPassword();
      await userService.updatePassword(schoolId, admin.id, await hashPassword(temporaryPassword));
      await authTokenService.revokeAllForUser(schoolId, admin.id);
      await notificationService.notifyPasswordChanged(admin.email, "admin_reset");

      return { temporaryPassword };
    });
  },
};
