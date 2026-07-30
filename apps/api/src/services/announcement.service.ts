import { prisma, Role } from "@sms/db";

export interface AnnouncementViewer {
  isStaff: boolean;
  role: Role;
  classIds: string[];
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
  list(schoolId: string, viewer: AnnouncementViewer) {
    return prisma.announcement.findMany({
      where: { schoolId, ...visibilityWhere(viewer) },
      include: announcementInclude,
      orderBy: { createdAt: "desc" },
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
