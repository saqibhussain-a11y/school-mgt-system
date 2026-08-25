import { prisma } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";
import { toUtcMidnight } from "../lib/examSchedule";

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export const scheduleEntryService = {
  list(schoolId: string, chapterId: string) {
    return prisma.scheduleEntry.findMany({
      where: { schoolId, chapterId },
      orderBy: { startDate: "asc" },
    });
  },

  async create(schoolId: string, data: { chapterId: string; startDate: Date; endDate: Date }) {
    const chapter = await prisma.chapter.findFirst({ where: { id: data.chapterId, schoolId } });
    if (!chapter) throw new HttpError(400, "Chapter not found");
    if (data.endDate < data.startDate) throw new HttpError(400, "End date can't be before start date");

    return prisma.scheduleEntry.create({ data: { schoolId, ...data } });
  },

  async update(schoolId: string, id: string, data: { startDate?: Date; endDate?: Date }) {
    const existing = await prisma.scheduleEntry.findFirst({ where: { id, schoolId } });
    if (!existing) return null;

    const startDate = data.startDate ?? existing.startDate;
    const endDate = data.endDate ?? existing.endDate;
    if (endDate < startDate) throw new HttpError(400, "End date can't be before start date");

    return prisma.scheduleEntry.update({ where: { id }, data });
  },

  async remove(schoolId: string, id: string) {
    const existing = await prisma.scheduleEntry.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    await prisma.scheduleEntry.delete({ where: { id } });
    return existing;
  },

  // The two bulk-entry helpers from the confirmed design. Both just generate
  // plain ScheduleEntry rows for one chapter — not a separate model/mode.
  async bulkGenerate(
    schoolId: string,
    data: { chapterId: string; mode: "REPEAT_WEEKLY" | "SPLIT_DAYS"; startDate: Date; count: number },
  ) {
    const chapter = await prisma.chapter.findFirst({ where: { id: data.chapterId, schoolId } });
    if (!chapter) throw new HttpError(400, "Chapter not found");

    const start = toUtcMidnight(data.startDate);
    const rows =
      data.mode === "REPEAT_WEEKLY"
        ? Array.from({ length: data.count }, (_, i) => ({
            startDate: addDays(start, i * 7),
            endDate: addDays(start, i * 7 + 6),
          }))
        : Array.from({ length: data.count }, (_, i) => ({
            startDate: addDays(start, i),
            endDate: addDays(start, i),
          }));

    return prisma.$transaction(
      rows.map((row) =>
        prisma.scheduleEntry.create({ data: { schoolId, chapterId: data.chapterId, ...row } }),
      ),
    );
  },
};
