import { prisma, RoomType } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";

interface SubjectWriteInput {
  name?: string;
  periodsPerWeek?: number;
  requiresLab?: boolean;
  roomId?: string | null;
}

// A lab subject's specific room (if set) must actually be a lab — otherwise
// the timetable generator's "lab subjects use their assigned lab" guarantee
// is defeated silently by a data-entry mistake instead of loudly at write time.
async function assertRoomMatchesLabRequirement(schoolId: string, requiresLab: boolean, roomId?: string | null) {
  if (!requiresLab || !roomId) return;
  const room = await prisma.room.findFirst({ where: { id: roomId, schoolId } });
  if (!room) throw new HttpError(400, "Room not found");
  if (room.type !== RoomType.LAB) {
    throw new HttpError(400, "A lab subject's room must be a lab room");
  }
}

export const subjectService = {
  list(schoolId: string, classId?: string) {
    return prisma.subject.findMany({
      where: { schoolId, ...(classId ? { classId } : {}) },
      include: { room: true },
      orderBy: { name: "asc" },
    });
  },

  getById(schoolId: string, id: string) {
    return prisma.subject.findFirst({ where: { id, schoolId }, include: { room: true } });
  },

  async create(schoolId: string, data: { classId: string; name: string } & SubjectWriteInput) {
    const cls = await prisma.class.findFirst({ where: { id: data.classId, schoolId } });
    if (!cls) {
      throw new HttpError(400, "Class not found");
    }
    await assertRoomMatchesLabRequirement(schoolId, data.requiresLab ?? false, data.roomId);
    return prisma.subject.create({ data: { ...data, schoolId } });
  },

  async update(schoolId: string, id: string, data: SubjectWriteInput) {
    const existing = await prisma.subject.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    const requiresLab = data.requiresLab ?? existing.requiresLab;
    const roomId = data.roomId !== undefined ? data.roomId : existing.roomId;
    await assertRoomMatchesLabRequirement(schoolId, requiresLab, roomId);
    return prisma.subject.update({ where: { id }, data });
  },

  async remove(schoolId: string, id: string) {
    const existing = await prisma.subject.findFirst({
      where: { id, schoolId },
      include: {
        _count: { select: { examSubjects: true, assignments: true, timetableSlots: true, teacherAssignments: true } },
      },
    });
    if (!existing) return null;
    const inUse =
      existing._count.examSubjects > 0 ||
      existing._count.assignments > 0 ||
      existing._count.timetableSlots > 0 ||
      existing._count.teacherAssignments > 0;
    if (inUse) {
      throw new HttpError(400, "Cannot delete a subject that's used by an exam, assignment, or timetable");
    }
    return prisma.subject.delete({ where: { id } });
  },
};
