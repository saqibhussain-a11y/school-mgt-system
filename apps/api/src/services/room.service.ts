import { prisma, RoomType } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";

export const roomService = {
  list(schoolId: string) {
    return prisma.room.findMany({ where: { schoolId }, orderBy: { name: "asc" } });
  },

  getById(schoolId: string, id: string) {
    return prisma.room.findFirst({ where: { id, schoolId } });
  },

  create(schoolId: string, data: { name: string; type: RoomType; capacity?: number }) {
    return prisma.room.create({ data: { schoolId, ...data } });
  },

  async update(schoolId: string, id: string, data: { name: string; type: RoomType; capacity?: number }) {
    const existing = await prisma.room.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    return prisma.room.update({ where: { id }, data });
  },

  async remove(schoolId: string, id: string) {
    const existing = await prisma.room.findFirst({
      where: { id, schoolId },
      include: { _count: { select: { timetableSlots: true, classesDefaultingHere: true, subjects: true } } },
    });
    if (!existing) return null;
    const inUse =
      existing._count.timetableSlots > 0 ||
      existing._count.classesDefaultingHere > 0 ||
      existing._count.subjects > 0;
    if (inUse) {
      throw new HttpError(400, "Cannot delete a room that's in use by a timetable, class, or subject");
    }
    await prisma.room.delete({ where: { id } });
    return existing;
  },
};
