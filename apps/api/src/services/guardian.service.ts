import { prisma, Role } from "@sms/db";
import { hashPassword } from "../lib/password";

export interface CreateGuardianInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
}

const guardianInclude = {
  user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
};

export const guardianService = {
  list(schoolId: string) {
    return prisma.guardian.findMany({
      where: { schoolId },
      include: guardianInclude,
      orderBy: { createdAt: "desc" },
    });
  },

  getById(schoolId: string, id: string) {
    return prisma.guardian.findFirst({ where: { id, schoolId }, include: guardianInclude });
  },

  findByEmail(schoolId: string, email: string) {
    return prisma.guardian.findFirst({
      where: { schoolId, user: { email } },
      include: guardianInclude,
    });
  },

  async create(schoolId: string, input: CreateGuardianInput) {
    const passwordHash = await hashPassword(input.password);

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          schoolId,
          email: input.email,
          passwordHash,
          role: Role.PARENT,
          firstName: input.firstName,
          lastName: input.lastName,
        },
      });

      return tx.guardian.create({
        data: {
          schoolId,
          userId: user.id,
          phone: input.phone,
          address: input.address,
        },
        include: guardianInclude,
      });
    });
  },

  async update(schoolId: string, id: string, data: Partial<{ phone: string; address: string }>) {
    const existing = await prisma.guardian.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    return prisma.guardian.update({ where: { id }, data, include: guardianInclude });
  },
};
