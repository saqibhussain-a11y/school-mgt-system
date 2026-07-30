import { prisma, Role, StaffStatus } from "@sms/db";
import { hashPassword } from "../lib/password";

export interface CreateStaffInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
  designation: string;
  joiningDate?: Date;
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
    const passwordHash = await hashPassword(input.password);

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          schoolId,
          email: input.email,
          passwordHash,
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
};
