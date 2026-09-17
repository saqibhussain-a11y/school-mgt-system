import { prisma, Role } from "@sms/db";
import { hashPassword } from "../lib/password";
import { skipTake, type PaginationParams, type Paginated } from "../lib/pagination";

const LIST_SAFETY_CAP = 2000;

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

type GuardianListFilters = { search?: string };

function guardianListWhere(schoolId: string, filters: GuardianListFilters) {
  return {
    schoolId,
    ...(filters.search
      ? {
          OR: [
            { user: { firstName: { contains: filters.search, mode: "insensitive" as const } } },
            { user: { lastName: { contains: filters.search, mode: "insensitive" as const } } },
            { user: { email: { contains: filters.search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
}

export const guardianService = {
  list(schoolId: string, filters: GuardianListFilters = {}) {
    return prisma.guardian.findMany({
      where: guardianListWhere(schoolId, filters),
      include: guardianInclude,
      orderBy: { createdAt: "desc" },
      take: LIST_SAFETY_CAP,
    });
  },

  async listPaginated(schoolId: string, filters: GuardianListFilters, pagination: PaginationParams) {
    const where = guardianListWhere(schoolId, filters);
    const [data, total] = await Promise.all([
      prisma.guardian.findMany({
        where,
        include: guardianInclude,
        orderBy: { createdAt: "desc" },
        ...skipTake(pagination, LIST_SAFETY_CAP),
      }),
      prisma.guardian.count({ where }),
    ]);
    return { data, total, page: pagination.page, pageSize: pagination.pageSize } satisfies Paginated<(typeof data)[number]>;
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
