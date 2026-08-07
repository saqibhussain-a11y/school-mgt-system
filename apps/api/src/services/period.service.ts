import { prisma } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";

export const periodService = {
  list(schoolId: string) {
    return prisma.period.findMany({ where: { schoolId }, orderBy: { periodNumber: "asc" } });
  },

  getById(schoolId: string, id: string) {
    return prisma.period.findFirst({ where: { id, schoolId } });
  },

  create(schoolId: string, data: { periodNumber: number; startTime: string; endTime: string; isBreak: boolean }) {
    return prisma.period.create({ data: { schoolId, ...data } });
  },

  async update(
    schoolId: string,
    id: string,
    data: { periodNumber: number; startTime: string; endTime: string; isBreak: boolean },
  ) {
    const existing = await prisma.period.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    return prisma.period.update({ where: { id }, data });
  },

  async remove(schoolId: string, id: string) {
    const existing = await prisma.period.findFirst({
      where: { id, schoolId },
      include: { _count: { select: { timetableSlots: true } } },
    });
    if (!existing) return null;
    if (existing._count.timetableSlots > 0) {
      throw new HttpError(400, "Cannot delete a period that's used by the timetable");
    }
    await prisma.period.delete({ where: { id } });
    return existing;
  },
};
