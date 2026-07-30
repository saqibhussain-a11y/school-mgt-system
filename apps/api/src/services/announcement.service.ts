import { prisma, Role } from "@sms/db";
import { studentService } from "./student.service";
import { studentGuardianService } from "./studentGuardian.service";

export interface AnnouncementViewer {
  isStaff: boolean;
  role: Role;
  classIds: string[];
}

const STAFF_ROLES: Role[] = [
  Role.SUPER_ADMIN,
  Role.SCHOOL_ADMIN,
  Role.PRINCIPAL,
  Role.TEACHER,
  Role.ACCOUNTANT,
  Role.LIBRARIAN,
  Role.TRANSPORT_MANAGER,
];

export async function buildAnnouncementViewer(
  schoolId: string,
  user: { sub: string; role: string },
): Promise<AnnouncementViewer> {
  const role = user.role as Role;
  if (STAFF_ROLES.includes(role)) {
    return { isStaff: true, role, classIds: [] };
  }
  if (role === Role.STUDENT) {
    const classId = await studentService.getOwnClassId(schoolId, user.sub);
    return { isStaff: false, role, classIds: classId ? [classId] : [] };
  }
  if (role === Role.PARENT) {
    const classIds = await studentGuardianService.getLinkedClassIds(schoolId, user.sub);
    return { isStaff: false, role, classIds };
  }
  return { isStaff: false, role, classIds: [] };
}

const announcementInclude = {
  creator: { select: { id: true, firstName: true, lastName: true, role: true } },
  targetClass: true,
};

function visibilityWhere(viewer: AnnouncementViewer) {
  if (viewer.isStaff) return {};
  return {
    AND: [
      { OR: [{ targetRole: null }, { targetRole: viewer.role }] },
      { OR: [{ targetClassId: null }, { targetClassId: { in: viewer.classIds } }] },
    ],
  };
}

export const announcementService = {
  list(schoolId: string, viewer: AnnouncementViewer, limit?: number) {
    return prisma.announcement.findMany({
      where: { schoolId, ...visibilityWhere(viewer) },
      include: announcementInclude,
      orderBy: { createdAt: "desc" },
      ...(limit ? { take: limit } : {}),
    });
  },

  async getVisibleById(schoolId: string, id: string, viewer: AnnouncementViewer) {
    return prisma.announcement.findFirst({
      where: { id, schoolId, ...visibilityWhere(viewer) },
      include: announcementInclude,
    });
  },

  getById(schoolId: string, id: string) {
    return prisma.announcement.findFirst({ where: { id, schoolId }, include: announcementInclude });
  },

  create(
    schoolId: string,
    data: { title: string; body: string; targetRole?: Role; targetClassId?: string; createdBy: string },
  ) {
    return prisma.announcement.create({ data: { ...data, schoolId }, include: announcementInclude });
  },

  async update(
    schoolId: string,
    id: string,
    data: Partial<{ title: string; body: string; targetRole: Role | null; targetClassId: string | null }>,
  ) {
    const existing = await prisma.announcement.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    return prisma.announcement.update({ where: { id }, data, include: announcementInclude });
  },

  async remove(schoolId: string, id: string) {
    const existing = await prisma.announcement.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    await prisma.announcement.delete({ where: { id } });
    return existing;
  },
};
