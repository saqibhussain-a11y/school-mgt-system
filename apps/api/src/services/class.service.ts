import { prisma } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";

export const classService = {
  list(schoolId: string, academicSessionId?: string) {
    return prisma.class.findMany({
      where: { schoolId, ...(academicSessionId ? { academicSessionId } : {}) },
      include: { defaultRoom: true },
      orderBy: { name: "asc" },
    });
  },

  getById(schoolId: string, id: string) {
    return prisma.class.findFirst({ where: { id, schoolId }, include: { defaultRoom: true } });
  },

  async create(
    schoolId: string,
    data: { academicSessionId: string; name: string; defaultRoomId?: string | null },
  ) {
    const session = await prisma.academicSession.findFirst({
      where: { id: data.academicSessionId, schoolId },
    });
    if (!session) {
      throw new HttpError(400, "Academic session not found");
    }
    if (data.defaultRoomId) {
      const room = await prisma.room.findFirst({ where: { id: data.defaultRoomId, schoolId } });
      if (!room) throw new HttpError(400, "Room not found");
    }
    return prisma.class.create({ data: { ...data, schoolId } });
  },

  async update(schoolId: string, id: string, data: Partial<{ name: string; defaultRoomId: string | null }>) {
    const existing = await prisma.class.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    if (data.defaultRoomId) {
      const room = await prisma.room.findFirst({ where: { id: data.defaultRoomId, schoolId } });
      if (!room) throw new HttpError(400, "Room not found");
    }
    return prisma.class.update({ where: { id }, data });
  },

  async remove(schoolId: string, id: string) {
    const existing = await prisma.class.findFirst({
      where: { id, schoolId },
      include: { _count: { select: { sections: true, subjects: true, students: true } } },
    });
    if (!existing) return null;
    const inUse =
      existing._count.sections > 0 || existing._count.subjects > 0 || existing._count.students > 0;
    if (inUse) {
      throw new HttpError(400, "Cannot delete a class that has sections, subjects, or students");
    }
    return prisma.class.delete({ where: { id } });
  },
};
