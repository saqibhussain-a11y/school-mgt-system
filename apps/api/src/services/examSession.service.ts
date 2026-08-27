import { prisma, SeatingStrategy } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";

export interface ExamSessionInput {
  academicSessionId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  seatingStrategy?: SeatingStrategy;
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

  // Switching strategy is only safe on a clean slate — a mid-flight switch
  // would leave COLUMN_BLOCKED's manual rows sitting under the wrong mental
  // model (or vice versa), so require the admin to clear seating first.
  async update(schoolId: string, id: string, data: Partial<ExamSessionInput>) {
    const existing = await prisma.examSession.findFirst({
      where: { id, schoolId },
      include: { _count: { select: { seatAllocations: true } } },
    });
    if (!existing) return null;
    if (
      data.seatingStrategy !== undefined &&
      data.seatingStrategy !== existing.seatingStrategy &&
      existing._count.seatAllocations > 0
    ) {
      throw new HttpError(
        400,
        "Cannot change seating strategy once seats have been assigned — remove existing seat allocations first.",
      );
    }
    return prisma.examSession.update({ where: { id }, data, include: examSessionInclude });
  },

  async remove(schoolId: string, id: string) {
    const existing = await prisma.examSession.findFirst({
      where: { id, schoolId },
      include: { _count: { select: { exams: true, seatAllocations: true, invigilations: true } } },
    });
    if (!existing) return null;
    if (existing._count.exams > 0) {
      throw new HttpError(400, "Cannot delete an exam session that still has classes linked to it");
    }
    // Neither ExamSeatAllocation nor ExamInvigilation cascade-delete with
    // their session (they represent real admin work — silently dropping
    // them on session delete would be a silent data-loss risk) — surfaced
    // by testing, since deleting a session's exams first (the only guard
    // that existed here before) still left these rows behind, and the FK
    // then turned a routine delete into an unhandled 500.
    if (existing._count.seatAllocations > 0 || existing._count.invigilations > 0) {
      throw new HttpError(
        400,
        "Cannot delete an exam session with seat allocations or invigilation duties — remove those first.",
      );
    }
    await prisma.examSession.delete({ where: { id } });
    return existing;
  },
};
