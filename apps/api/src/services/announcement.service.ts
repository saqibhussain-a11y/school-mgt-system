import { prisma, Role } from "@sms/db";
import { studentService } from "./student.service";
import { studentGuardianService } from "./studentGuardian.service";
import { inAppNotificationService } from "./inAppNotification.service";

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

// Mirrors visibilityWhere's logic in reverse (which users would see this
// announcement) so notification recipients exactly match who'd find it on
// their announcements list. Staff always see every announcement regardless
// of targetRole/targetClassId (see buildAnnouncementViewer), so they're
// always notified; students/parents are notified only if the target
// filters admit them.
async function resolveRecipientUserIds(schoolId: string, targetRole?: Role | null, targetClassId?: string | null) {
  const staffUsers = await prisma.user.findMany({
    where: { schoolId, role: { in: STAFF_ROLES } },
    select: { id: true },
  });
  const recipients = new Set(staffUsers.map((u) => u.id));

  const wantsStudents = !targetRole || targetRole === Role.STUDENT;
  const wantsParents = !targetRole || targetRole === Role.PARENT;

  if (wantsStudents) {
    const students = await prisma.student.findMany({
      where: { schoolId, status: "ACTIVE", ...(targetClassId ? { classId: targetClassId } : {}) },
      select: { userId: true },
    });
    students.forEach((s) => recipients.add(s.userId));
  }

  if (wantsParents) {
    const links = await prisma.studentGuardian.findMany({
      where: { schoolId, ...(targetClassId ? { student: { classId: targetClassId } } : {}) },
      select: { guardian: { select: { userId: true } } },
    });
    links.forEach((l) => recipients.add(l.guardian.userId));
  }

  return [...recipients];
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

  async create(
    schoolId: string,
    data: { title: string; body: string; targetRole?: Role; targetClassId?: string; createdBy: string },
  ) {
    const announcement = await prisma.announcement.create({
      data: { ...data, schoolId },
      include: announcementInclude,
    });

    const recipientUserIds = await resolveRecipientUserIds(schoolId, data.targetRole, data.targetClassId);
    await inAppNotificationService.notifyMany(
      schoolId,
      recipientUserIds.filter((id) => id !== data.createdBy),
      { type: "announcement", title: "New announcement", body: data.title, link: "/dashboard/announcements" },
    );

    return announcement;
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
