import { prisma, Role, runAsPlatform } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";
import { hashPassword } from "../lib/password";
import { generateTempPassword } from "../lib/tempPassword";
import { notificationService } from "./notification.service";
import { userService } from "./user.service";
import { authTokenService } from "./authToken.service";
import { platformAuditLogService } from "./platformAuditLog.service";
import type { PlanKey } from "../config/plans";

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

  async create(
    platformAdminId: string,
    data: {
      name: string;
      subdomain: string;
      adminEmail: string;
      adminFirstName: string;
      adminLastName: string;
      subscriptionPlan?: PlanKey;
    },
  ) {
    return runAsPlatform(async () => {
      const existing = await prisma.school.findUnique({ where: { subdomain: data.subdomain } });
      if (existing) throw new HttpError(409, "A school with this subdomain already exists");

      const temporaryPassword = generateTempPassword();
      const passwordHash = await hashPassword(temporaryPassword);

      const school = await prisma.$transaction(async (tx) => {
        const created = await tx.school.create({
          data: {
            name: data.name,
            subdomain: data.subdomain,
            ...(data.subscriptionPlan ? { subscriptionPlan: data.subscriptionPlan } : {}),
          },
        });
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
        await platformAuditLogService.record(tx, {
          platformAdminId,
          action: "school.create",
          targetType: "School",
          targetId: created.id,
          metadata: { name: data.name, subdomain: data.subdomain },
        });
        return created;
      });

      await notificationService.notifyNewAccount(data.adminEmail, data.adminFirstName, temporaryPassword);
      return { ...school, adminEmail: data.adminEmail, adminTemporaryPassword: temporaryPassword };
    });
  },

  async updateSubscription(
    platformAdminId: string,
    id: string,
    data: { subscriptionStatus?: string; subscriptionPlan?: string },
  ) {
    return runAsPlatform(async () => {
      const existing = await prisma.school.findUnique({ where: { id } });
      if (!existing) return null;
      if (!data.subscriptionStatus && !data.subscriptionPlan) return existing;

      return prisma.$transaction(async (tx) => {
        const updated = await tx.school.update({
          where: { id },
          data: {
            ...data,
            ...(data.subscriptionStatus && data.subscriptionStatus !== existing.subscriptionStatus
              ? { subscriptionStatusChangedAt: new Date() }
              : {}),
          },
        });
        await platformAuditLogService.record(tx, {
          platformAdminId,
          action: "school.update_subscription",
          targetType: "School",
          targetId: id,
          metadata: { from: existing, to: data },
        });
        return updated;
      });
    });
  },

  getUsage(schoolId: string) {
    return runAsPlatform(async () => {
      const [studentCount, staffCount, classCount, mostRecentLogin] = await Promise.all([
        prisma.student.count({ where: { schoolId, status: "ACTIVE" } }),
        prisma.staff.count({ where: { schoolId, status: "ACTIVE" } }),
        prisma.class.count({ where: { schoolId } }),
        prisma.user.findFirst({
          where: { schoolId },
          orderBy: { lastLoginAt: "desc" },
          select: { lastLoginAt: true },
        }),
      ]);
      return { studentCount, staffCount, classCount, lastActiveAt: mostRecentLogin?.lastLoginAt ?? null };
    });
  },

  getAdmins(schoolId: string) {
    return runAsPlatform(() => userService.listByRole(schoolId, Role.SCHOOL_ADMIN));
  },

  // Used by the impersonation flow — the oldest SCHOOL_ADMIN account is the
  // one every school always has (created alongside the school itself).
  getOldestAdmin(schoolId: string) {
    return runAsPlatform(() =>
      prisma.user.findFirst({
        where: { schoolId, role: Role.SCHOOL_ADMIN },
        orderBy: { createdAt: "asc" },
      }),
    );
  },

  async createAdmin(
    platformAdminId: string,
    schoolId: string,
    data: { email: string; firstName: string; lastName: string },
  ) {
    return runAsPlatform(async () => {
      const school = await prisma.school.findUnique({ where: { id: schoolId } });
      if (!school) throw new HttpError(404, "School not found");

      const existing = await prisma.user.findUnique({
        where: { schoolId_email: { schoolId, email: data.email } },
      });
      if (existing) throw new HttpError(409, "A user with this email already exists at this school");

      const temporaryPassword = generateTempPassword();
      const passwordHash = await hashPassword(temporaryPassword);
      const admin = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            schoolId,
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            passwordHash,
            role: Role.SCHOOL_ADMIN,
          },
        });
        await platformAuditLogService.record(tx, {
          platformAdminId,
          action: "admin.create",
          targetType: "School",
          targetId: schoolId,
          metadata: { adminId: created.id, email: data.email },
        });
        return created;
      });

      await notificationService.notifyNewAccount(data.email, data.firstName, temporaryPassword);
      return { id: admin.id, email: admin.email, firstName: admin.firstName, lastName: admin.lastName };
    });
  },

  async resetAdminPassword(platformAdminId: string, schoolId: string, adminId: string) {
    return runAsPlatform(async () => {
      const admin = await prisma.user.findFirst({
        where: { id: adminId, schoolId, role: Role.SCHOOL_ADMIN },
      });
      if (!admin) throw new HttpError(404, "Admin not found at this school");

      const temporaryPassword = generateTempPassword();
      const passwordHash = await hashPassword(temporaryPassword);
      await prisma.$transaction(async (tx) => {
        await tx.user.updateMany({ where: { id: admin.id, schoolId }, data: { passwordHash, isActivated: true } });
        await platformAuditLogService.record(tx, {
          platformAdminId,
          action: "admin.reset_password",
          targetType: "School",
          targetId: schoolId,
          metadata: { adminId: admin.id, email: admin.email },
        });
      });
      await authTokenService.revokeAllForUser(schoolId, admin.id);
      await notificationService.notifyPasswordChanged(admin.email, "admin_reset");

      return { temporaryPassword };
    });
  },
};
