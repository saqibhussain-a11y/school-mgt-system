import { prisma, Role, runAsPlatform } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";
import { hashPassword } from "../lib/password";
import { generateTempPassword } from "../lib/tempPassword";
import { notificationService } from "./notification.service";

export const schoolService = {
  // Public/unauthenticated — the login page needs to resolve a school before
  // a user has any credentials, so this stays open, but deliberately returns
  // nothing beyond what a school picker needs (no subdomain/subscription data).
  // Not filtered by whether a school happens to contain a super admin — that
  // would also hide every *other* legitimate user in the same school. The
  // real boundary is in authService.login, which refuses SUPER_ADMIN
  // outright regardless of which school its account lives in.
  listForLogin() {
    return prisma.school.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  },

  // Platform-only — spans every tenant, so it runs outside any tenant
  // context (there is no schoolId to filter by; School is the tenant root).
  listForPlatform() {
    return runAsPlatform(() => prisma.school.findMany({ orderBy: { createdAt: "desc" } }));
  },

  // Creates a brand-new tenant plus its first SCHOOL_ADMIN in one
  // transaction, then emails that admin their temporary password —
  // reusing the same generateTempPassword/notifyNewAccount pattern already
  // used for student/staff account creation.
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
};
