import { prisma } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";

export interface ExamSessionInput {
  academicSessionId: string;
  name: string;
  startDate: Date;
  endDate: Date;
}

const examSessionInclude = {
  exams: { include: { class: true } },
};

export const examSessionService = {
  // isAutoCreated sessions are an internal implementation detail (created
  // lazily by examSeating.service.ts for a standalone exam) — hidden from
  // the "combine with other classes" picker.
  list(schoolId: string) {
    return prisma.examSession.findMany({
      where: { schoolId, isAutoCreated: false },
      include: examSessionInclude,
      orderBy: { startDate: "desc" },
    });
  },

  getById(schoolId: string, id: string) {
    return prisma.examSession.findFirst({ where: { id, schoolId }, include: examSessionInclude });
  },

  create(schoolId: string, data: ExamSessionInput) {
    return prisma.examSession.create({ data: { schoolId, ...data }, include: examSessionInclude });
  },

  async update(schoolId: string, id: string, data: Partial<ExamSessionInput>) {
    const existing = await prisma.examSession.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    return prisma.examSession.update({ where: { id }, data, include: examSessionInclude });
  },

  async remove(schoolId: string, id: string) {
    const existing = await prisma.examSession.findFirst({
      where: { id, schoolId },
      include: { _count: { select: { exams: true } } },
    });
    if (!existing) return null;
    if (existing._count.exams > 0) {
      throw new HttpError(400, "Cannot delete an exam session that still has classes linked to it");
    }
    await prisma.examSession.delete({ where: { id } });
    return existing;
  },
};
