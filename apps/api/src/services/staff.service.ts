import { randomUUID } from "crypto";
import { prisma, Role, StaffStatus, DayOfWeek } from "@sms/db";
import { hashPassword } from "../lib/password";
import { generateTempPassword } from "../lib/tempPassword";
import { generateOtp } from "../lib/otp";
import { planService } from "./plan.service";
import { passwordResetService } from "./passwordReset.service";
import { notificationService } from "./notification.service";

export interface CreateStaffInput {
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  designation: string;
  joiningDate?: Date;
  mode: "ADMIN_SET" | "SELF_SERVICE";
}

const staffInclude = {
  user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
};

export const staffService = {
  list(schoolId: string) {
    return prisma.staff.findMany({
      where: { schoolId },
      include: staffInclude,
      orderBy: { createdAt: "desc" },
    });
  },

  getById(schoolId: string, id: string) {
    return prisma.staff.findFirst({ where: { id, schoolId }, include: staffInclude });
  },

  getByUserId(schoolId: string, userId: string) {
    return prisma.staff.findFirst({ where: { schoolId, userId } });
  },

  async create(schoolId: string, input: CreateStaffInput) {
    const isInvite = input.mode === "SELF_SERVICE";
    const temporaryPassword = isInvite ? undefined : generateTempPassword();
    const passwordHash = await hashPassword(temporaryPassword ?? randomUUID());
    const otp = isInvite ? generateOtp() : undefined;

    const staff = await prisma.$transaction(async (tx) => {
      await planService.assertSeatAvailable(tx, schoolId, "staff", 1);

      const user = await tx.user.create({
        data: {
          schoolId,
          email: input.email,
          passwordHash,
          isActivated: !isInvite,
          role: input.role,
          firstName: input.firstName,
          lastName: input.lastName,
        },
      });

      return tx.staff.create({
        data: {
          schoolId,
          userId: user.id,
          designation: input.designation,
          joiningDate: input.joiningDate,
        },
        include: staffInclude,
      });
    });

    if (isInvite) {
      await passwordResetService.create(schoolId, staff.userId, otp!);
      await notificationService.notifyAccountInvite(schoolId, input.email, input.firstName, otp!);
    } else {
      await notificationService.notifyNewAccount(input.email, input.firstName, temporaryPassword!);
    }

    return { ...staff, mode: input.mode, ...(temporaryPassword ? { temporaryPassword } : {}) };
  },

  async update(schoolId: string, id: string, data: Partial<{ designation: string }>) {
    const existing = await prisma.staff.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    return prisma.staff.update({ where: { id }, data, include: staffInclude });
  },

  async deactivate(schoolId: string, id: string) {
    const existing = await prisma.staff.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    return prisma.staff.update({ where: { id }, data: { status: StaffStatus.DEACTIVATED } });
  },

  async updateAvailability(
    schoolId: string,
    id: string,
    data: {
      workingDays: DayOfWeek[];
      periodsAvailableFrom?: number | null;
      periodsAvailableTo?: number | null;
      maxPeriodsPerWeek?: number | null;
    },
  ) {
    const existing = await prisma.staff.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    return prisma.staff.update({ where: { id }, data });
  },
};
