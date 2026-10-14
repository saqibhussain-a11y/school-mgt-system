import { prisma, Role, StudentStatus } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";
import { putObject, getDownloadUrl, deleteObject } from "../lib/storage";
import { skipTake, type PaginationParams, type Paginated } from "../lib/pagination";
import { getAssignedSectionIdsForUser } from "./teacherAssignment.service";
import { studentGuardianService } from "./studentGuardian.service";
import { inAppNotificationService } from "./inAppNotification.service";

const LIST_SAFETY_CAP = 500;
const MANAGE_ALL_ROLES: string[] = [Role.SCHOOL_ADMIN, Role.PRINCIPAL];

// Content type comes from this map, never from the client's claimed mimetype —
// photos render inline, so a spoofed text/html upload must not be served as HTML.
export const DIARY_PHOTO_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

interface Viewer {
  sub: string;
  role: string;
}

export interface CreateDiaryEntryInput {
  sectionId: string;
  studentId?: string;
  date: Date;
  content: string;
}

const entryInclude = {
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  student: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
  _count: { select: { acknowledgments: true } },
};

function photoUrl(key: string | null) {
  return key ? getDownloadUrl(key) : Promise.resolve(null);
}

function preview(content: string) {
  return content.length > 80 ? `${content.slice(0, 77)}…` : content;
}

async function guardianUserIdsByStudent(schoolId: string, studentIds: string[]) {
  const links = await prisma.studentGuardian.findMany({
    where: { schoolId, studentId: { in: studentIds } },
    select: { studentId: true, guardian: { select: { userId: true } } },
  });
  const map = new Map<string, string[]>();
  for (const l of links) map.set(l.studentId, [...(map.get(l.studentId) ?? []), l.guardian.userId]);
  return map;
}

export const diaryService = {
  async listPostableSections(schoolId: string, viewer: Viewer) {
    const where = MANAGE_ALL_ROLES.includes(viewer.role)
      ? { schoolId }
      : { schoolId, id: { in: await getAssignedSectionIdsForUser(schoolId, viewer.sub) } };
    const sections = await prisma.section.findMany({
      where,
      include: { class: { select: { name: true } } },
      orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
    });
    return sections.map((s) => ({ id: s.id, name: s.name, classId: s.classId, className: s.class.name }));
  },

  async assertCanManageSection(schoolId: string, viewer: Viewer, sectionId: string) {
    if (MANAGE_ALL_ROLES.includes(viewer.role)) return;
    if (viewer.role === Role.TEACHER) {
      const sectionIds = await getAssignedSectionIdsForUser(schoolId, viewer.sub);
      if (sectionIds.includes(sectionId)) return;
    }
    throw new HttpError(403, "You can only manage the diary for sections you teach");
  },

  async listForSection(
    schoolId: string,
    viewer: Viewer,
    sectionId: string,
    pagination: PaginationParams,
    date?: Date,
  ): Promise<Paginated<unknown>> {
    await this.assertCanManageSection(schoolId, viewer, sectionId);
    const where = { schoolId, sectionId, ...(date ? { date } : {}) };
    const [entries, total, students] = await Promise.all([
      prisma.diaryEntry.findMany({
        where,
        include: entryInclude,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        ...skipTake(pagination, LIST_SAFETY_CAP),
      }),
      prisma.diaryEntry.count({ where }),
      prisma.student.findMany({
        where: { schoolId, sectionId, status: StudentStatus.ACTIVE },
        select: { id: true },
      }),
    ]);

    const guardiansByStudent = await guardianUserIdsByStudent(
      schoolId,
      students.map((s) => s.id),
    );
    const sectionParentCount = new Set([...guardiansByStudent.values()].flat()).size;

    const data = await Promise.all(
      entries.map(async (e) => ({
        id: e.id,
        date: e.date,
        content: e.content,
        photoUrl: await photoUrl(e.photoKey),
        createdAt: e.createdAt,
        createdBy: e.createdBy,
        student: e.student
          ? { id: e.student.id, firstName: e.student.user.firstName, lastName: e.student.user.lastName }
          : null,
        acknowledgedCount: e._count.acknowledgments,
        recipientCount: e.studentId ? (guardiansByStudent.get(e.studentId)?.length ?? 0) : sectionParentCount,
        canEdit: MANAGE_ALL_ROLES.includes(viewer.role) || e.createdByUserId === viewer.sub,
      })),
    );
    return { data, total, page: pagination.page, pageSize: pagination.pageSize };
  },

  async assertCanViewStudent(schoolId: string, viewer: Viewer, studentId: string) {
    if (viewer.role === Role.STUDENT) {
      const own = await prisma.student.findFirst({ where: { schoolId, userId: viewer.sub, id: studentId } });
      if (own) return;
    }
    if (viewer.role === Role.PARENT && (await studentGuardianService.isGuardianOfStudent(schoolId, viewer.sub, studentId))) {
      return;
    }
    throw new HttpError(403, "You do not have permission to view this student's diary");
  },

  async listForStudent(
    schoolId: string,
    viewer: Viewer,
    studentId: string,
    pagination: PaginationParams,
  ): Promise<Paginated<unknown>> {
    await this.assertCanViewStudent(schoolId, viewer, studentId);
    const student = await prisma.student.findFirst({ where: { schoolId, id: studentId } });
    if (!student) throw new HttpError(404, "Student not found");

    const where = {
      schoolId,
      sectionId: student.sectionId,
      OR: [{ studentId: null }, { studentId }],
    };
    const [entries, total] = await Promise.all([
      prisma.diaryEntry.findMany({
        where,
        include: {
          createdBy: entryInclude.createdBy,
          acknowledgments: { where: { userId: viewer.sub }, select: { id: true } },
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        ...skipTake(pagination, LIST_SAFETY_CAP),
      }),
      prisma.diaryEntry.count({ where }),
    ]);

    const data = await Promise.all(
      entries.map(async (e) => ({
        id: e.id,
        date: e.date,
        content: e.content,
        photoUrl: await photoUrl(e.photoKey),
        createdAt: e.createdAt,
        createdBy: e.createdBy,
        isPersonal: e.studentId !== null,
        acknowledged: e.acknowledgments.length > 0,
      })),
    );
    return { data, total, page: pagination.page, pageSize: pagination.pageSize };
  },

  async create(
    schoolId: string,
    viewer: Viewer,
    input: CreateDiaryEntryInput,
    photo?: { buffer: Buffer; ext: string },
  ) {
    await this.assertCanManageSection(schoolId, viewer, input.sectionId);

    let recipients: { id: string; userId: string }[];
    if (input.studentId) {
      const student = await prisma.student.findFirst({
        where: { schoolId, id: input.studentId, sectionId: input.sectionId, status: StudentStatus.ACTIVE },
        select: { id: true, userId: true },
      });
      if (!student) throw new HttpError(400, "That student isn't an active member of this section");
      recipients = [student];
    } else {
      recipients = await prisma.student.findMany({
        where: { schoolId, sectionId: input.sectionId, status: StudentStatus.ACTIVE },
        select: { id: true, userId: true },
      });
    }

    const entry = await prisma.diaryEntry.create({
      data: {
        schoolId,
        sectionId: input.sectionId,
        studentId: input.studentId ?? null,
        date: input.date,
        content: input.content,
        createdByUserId: viewer.sub,
      },
    });

    if (photo) {
      const key = `schools/${schoolId}/diary/${entry.id}/${Date.now()}${photo.ext}`;
      await putObject(key, photo.buffer, DIARY_PHOTO_TYPES[photo.ext]);
      await prisma.diaryEntry.update({ where: { id: entry.id }, data: { photoKey: key } });
    }

    const parentUserIds = await studentGuardianService.getGuardianUserIdsForStudents(
      schoolId,
      recipients.map((r) => r.id),
    );
    await inAppNotificationService.notifyMany(schoolId, [...recipients.map((r) => r.userId), ...parentUserIds], {
      type: "diary",
      title: input.studentId ? "New personal diary note" : "New diary note",
      body: preview(input.content),
      link: "/dashboard/diary",
    });

    return entry;
  },

  async getManageable(schoolId: string, viewer: Viewer, id: string) {
    const entry = await prisma.diaryEntry.findFirst({ where: { schoolId, id } });
    if (!entry) throw new HttpError(404, "Diary entry not found");
    if (!MANAGE_ALL_ROLES.includes(viewer.role) && entry.createdByUserId !== viewer.sub) {
      throw new HttpError(403, "Only the author or a school admin can change this entry");
    }
    return entry;
  },

  async updateContent(schoolId: string, viewer: Viewer, id: string, content: string) {
    await this.getManageable(schoolId, viewer, id);
    return prisma.diaryEntry.update({ where: { id }, data: { content } });
  },

  async remove(schoolId: string, viewer: Viewer, id: string) {
    const entry = await this.getManageable(schoolId, viewer, id);
    await prisma.diaryEntry.delete({ where: { id } });
    if (entry.photoKey) await deleteObject(entry.photoKey).catch(() => {});
  },

  async acknowledge(schoolId: string, parentUserId: string, id: string) {
    const entry = await prisma.diaryEntry.findFirst({ where: { schoolId, id } });
    if (!entry) throw new HttpError(404, "Diary entry not found");

    const children = await studentGuardianService.getChildrenForGuardianUser(schoolId, parentUserId);
    const isRecipient = children.some((c) =>
      entry.studentId ? c.id === entry.studentId : c.sectionId === entry.sectionId,
    );
    if (!isRecipient) throw new HttpError(403, "This diary entry isn't addressed to your child");

    await prisma.diaryAcknowledgment.upsert({
      where: { diaryEntryId_userId: { diaryEntryId: id, userId: parentUserId } },
      create: { schoolId, diaryEntryId: id, userId: parentUserId },
      update: {},
    });
  },
};
