import { randomUUID } from "crypto";
import { prisma, Role, runAsPlatform } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";
import { hashPassword } from "../lib/password";
import { generateTempPassword } from "../lib/tempPassword";
import { generateOtp } from "../lib/otp";
import { notificationService } from "./notification.service";
import { userService } from "./user.service";
import { authTokenService } from "./authToken.service";
import { platformAuditLogService } from "./platformAuditLog.service";
import { passwordResetService } from "./passwordReset.service";
import { getOrSet, invalidate } from "../lib/cache";
import type { PlanKey } from "../config/plans";

type CredentialMode = "ADMIN_SET" | "SELF_SERVICE";

export const schoolService = {
  // Read on every authenticated request (see auth.middleware.ts) to block a
  // suspended school's users, so this is cached rather than hitting Postgres
  // per-request; updateSubscription() below invalidates it on change.
  getSubscriptionStatus(schoolId: string) {
    return getOrSet(`school:subscription-status:${schoolId}`, 30, async () => {
      const school = await prisma.school.findUnique({
        where: { id: schoolId },
        select: { subscriptionStatus: true },
      });
      return school?.subscriptionStatus ?? null;
    });
  },

  // Read by requireModule() on every gated request, so cached the same way
  // as getSubscriptionStatus above; updateModules() invalidates it on change.
  getEnabledModules(schoolId: string) {
    return getOrSet(`school:enabled-modules:${schoolId}`, 30, async () => {
      const school = await prisma.school.findUnique({
        where: { id: schoolId },
        select: { enabledModules: true },
      });
      return school?.enabledModules ?? [];
    });
  },

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
      mode: CredentialMode;
    },
  ) {
    return runAsPlatform(async () => {
      const existing = await prisma.school.findUnique({ where: { subdomain: data.subdomain } });
      if (existing) throw new HttpError(409, "A school with this subdomain already exists");

      const isInvite = data.mode === "SELF_SERVICE";
      const temporaryPassword = isInvite ? undefined : generateTempPassword();
      // Same unguessable-placeholder trick as student admission (see
      // student.service.ts's createOne) for the invite path — no real,
      // usable password should exist until the admin actually claims it.
      const passwordHash = await hashPassword(temporaryPassword ?? randomUUID());
      const otp = isInvite ? generateOtp() : undefined;

      const { school, adminId } = await prisma.$transaction(async (tx) => {
        const created = await tx.school.create({
          data: {
            name: data.name,
            subdomain: data.subdomain,
            ...(data.subscriptionPlan ? { subscriptionPlan: data.subscriptionPlan } : {}),
          },
        });
        const admin = await tx.user.create({
          data: {
            schoolId: created.id,
            email: data.adminEmail,
            passwordHash,
            isActivated: !isInvite,
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
        return { school: created, adminId: admin.id };
      });

      if (isInvite) {
        await passwordResetService.create(school.id, adminId, otp!);
        await notificationService.notifyAccountInvite(school.id, data.adminEmail, data.adminFirstName, otp!);
      } else {
        await notificationService.notifyNewAccount(data.adminEmail, data.adminFirstName, temporaryPassword!);
      }

      return {
        ...school,
        adminEmail: data.adminEmail,
        mode: data.mode,
        ...(temporaryPassword ? { adminTemporaryPassword: temporaryPassword } : {}),
      };
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
      }).then(async (updated) => {
        await invalidate(`school:subscription-status:${id}`);
        return updated;
      });
    });
  },

  async updateModules(platformAdminId: string, id: string, enabledModules: string[]) {
    return runAsPlatform(async () => {
      const existing = await prisma.school.findUnique({ where: { id } });
      if (!existing) return null;

      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.school.update({ where: { id }, data: { enabledModules } });
        await platformAuditLogService.record(tx, {
          platformAdminId,
          action: "school.update_modules",
          targetType: "School",
          targetId: id,
          metadata: { from: existing.enabledModules, to: enabledModules },
        });
        return result;
      });
      await invalidate(`school:enabled-modules:${id}`);
      return updated;
    });
  },

  getUsage(schoolId: string) {
    return runAsPlatform(async () => {
      const [studentCount, staffCount, classCount, mostRecentLogin] = await Promise.all([
        prisma.student.count({ where: { schoolId, status: "ACTIVE" } }),
        prisma.staff.count({ where: { schoolId, status: "ACTIVE" } }),
        prisma.class.count({ where: { schoolId } }),
        // Filtering out nulls rather than relying on ORDER BY ... DESC to
        // push them last — Postgres defaults nulls FIRST on a DESC sort, so
        // a never-logged-in user would otherwise always win over a real
        // recent login (caught live: showed "Never logged in" right after
        // logging in as that school's admin).
        prisma.user.findFirst({
          where: { schoolId, lastLoginAt: { not: null } },
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

  async createAdmin(
    platformAdminId: string,
    schoolId: string,
    data: { email: string; firstName: string; lastName: string; mode: CredentialMode },
  ) {
    return runAsPlatform(async () => {
      const school = await prisma.school.findUnique({ where: { id: schoolId } });
      if (!school) throw new HttpError(404, "School not found");

      const existing = await prisma.user.findUnique({
        where: { schoolId_email: { schoolId, email: data.email } },
      });
      if (existing) throw new HttpError(409, "A user with this email already exists at this school");

      const isInvite = data.mode === "SELF_SERVICE";
      const temporaryPassword = isInvite ? undefined : generateTempPassword();
      const passwordHash = await hashPassword(temporaryPassword ?? randomUUID());
      const otp = isInvite ? generateOtp() : undefined;

      const admin = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            schoolId,
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            passwordHash,
            isActivated: !isInvite,
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

      if (isInvite) {
        await passwordResetService.create(schoolId, admin.id, otp!);
        await notificationService.notifyAccountInvite(schoolId, data.email, data.firstName, otp!);
      } else {
        await notificationService.notifyNewAccount(data.email, data.firstName, temporaryPassword!);
      }

      return {
        id: admin.id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        mode: data.mode,
        ...(temporaryPassword ? { temporaryPassword } : {}),
      };
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
