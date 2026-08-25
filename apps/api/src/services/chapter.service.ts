import { prisma } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";

export const chapterService = {
  list(schoolId: string, syllabusId: string) {
    return prisma.chapter.findMany({
      where: { schoolId, syllabusId },
      include: { scheduleEntries: { orderBy: { startDate: "asc" } } },
      orderBy: { order: "asc" },
    });
  },

  async create(schoolId: string, data: { syllabusId: string; title: string; order: number }) {
    const syllabus = await prisma.syllabus.findFirst({ where: { id: data.syllabusId, schoolId } });
    if (!syllabus) throw new HttpError(400, "Syllabus not found");

    const clashing = await prisma.chapter.findFirst({
      where: { syllabusId: data.syllabusId, order: data.order },
    });
    if (clashing) throw new HttpError(409, `Chapter ${data.order} already exists in this syllabus`);

    return prisma.chapter.create({ data: { schoolId, ...data } });
  },

  async update(schoolId: string, id: string, data: { title?: string; order?: number }) {
    const existing = await prisma.chapter.findFirst({ where: { id, schoolId } });
    if (!existing) return null;

    if (data.order !== undefined && data.order !== existing.order) {
      const clashing = await prisma.chapter.findFirst({
        where: { syllabusId: existing.syllabusId, order: data.order },
      });
      if (clashing) throw new HttpError(409, `Chapter ${data.order} already exists in this syllabus`);
    }

    return prisma.chapter.update({ where: { id }, data });
  },

  // ScheduleEntry rows cascade-delete with the chapter — losing the pacing
  // plan for a chapter that's being deleted anyway is expected, not a bug.
  async remove(schoolId: string, id: string) {
    const existing = await prisma.chapter.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    await prisma.chapter.delete({ where: { id } });
    return existing;
  },
};
