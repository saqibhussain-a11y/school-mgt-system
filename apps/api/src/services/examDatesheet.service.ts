import { prisma } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";
import { dayOfWeekFromDate } from "../lib/examSchedule";

interface DatesheetExam {
  id: string;
  examSubjects: { id: string; examDate: Date | null }[];
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

// Subjects that already have an examDate (set manually or by a previous
// generate run) are left untouched — generation only fills in the gaps, so
// re-running it after a manual override never clobbers that override, and
// no separate GENERATED/MANUAL flag is needed on ExamSubject.
export const examDatesheetService = {
  async generate(schoolId: string, examId: string, params: { startTime: string; endTime: string }) {
    const exam = await prisma.exam.findFirst({
      where: { id: examId, schoolId },
      include: { examSession: true, examSubjects: { select: { id: true, examDate: true } } },
    });
    if (!exam) throw new HttpError(404, "Exam not found");

    let exams: DatesheetExam[];
    let rangeStart: Date;
    let rangeEnd: Date;

    if (exam.examSessionId && exam.examSession) {
      // Session-scoped: every linked class shares one walk over the
      // session's date range and one time block per day, so classes
      // combined for cross-class seating are always examined at the same
      // time on days they both have a paper — the whole reason to combine
      // them in one hall is that they're writing simultaneously.
      exams = await prisma.exam.findMany({
        where: { examSessionId: exam.examSessionId, schoolId },
        include: { examSubjects: { select: { id: true, examDate: true } } },
        orderBy: { classId: "asc" },
      });
      rangeStart = exam.examSession.startDate;
      rangeEnd = exam.examSession.endDate;
    } else {
      exams = [exam];
      rangeStart = exam.startDate;
      rangeEnd = exam.endDate;
    }

    const queues = new Map<string, string[]>(
      exams.map((e) => [e.id, e.examSubjects.filter((s) => !s.examDate).map((s) => s.id)]),
    );

    const updates: { id: string; examDate: Date }[] = [];
    let cursor = new Date(rangeStart);
    while (cursor <= rangeEnd && Array.from(queues.values()).some((q) => q.length > 0)) {
      if (dayOfWeekFromDate(cursor) !== null) {
        for (const examSubjectIds of queues.values()) {
          const nextId = examSubjectIds.shift();
          if (nextId) updates.push({ id: nextId, examDate: new Date(cursor) });
        }
      }
      cursor = addDays(cursor, 1);
    }

    if (updates.length > 0) {
      await prisma.$transaction(
        updates.map((u) =>
          prisma.examSubject.update({
            where: { id: u.id },
            data: { examDate: u.examDate, startTime: params.startTime, endTime: params.endTime },
          }),
        ),
      );
    }

    const warnings: string[] = [];
    const leftoverTotal = Array.from(queues.values()).reduce((sum, q) => sum + q.length, 0);
    if (leftoverTotal > 0) {
      warnings.push(
        `${leftoverTotal} subject(s) couldn't be scheduled — the exam's date range ran out before every subject got a day.`,
      );
    }

    return { updatedCount: updates.length, warnings };
  },

  async updateSchedule(
    schoolId: string,
    examSubjectId: string,
    data: { examDate: Date; startTime: string; endTime: string },
  ) {
    const examSubject = await prisma.examSubject.findFirst({
      where: { id: examSubjectId, schoolId },
      include: { exam: { include: { examSession: true } } },
    });
    if (!examSubject) throw new HttpError(404, "Exam subject not found");

    const rangeStart = examSubject.exam.examSession?.startDate ?? examSubject.exam.startDate;
    const rangeEnd = examSubject.exam.examSession?.endDate ?? examSubject.exam.endDate;
    if (data.examDate < rangeStart || data.examDate > rangeEnd) {
      throw new HttpError(400, "The scheduled date must fall within the exam's date range");
    }
    if (dayOfWeekFromDate(data.examDate) === null) {
      throw new HttpError(400, "Exams cannot be scheduled on a Sunday");
    }

    // Proactive check ahead of the @@unique([examId, examDate]) DB
    // constraint, purely for a clearer error message than the generic P2002
    // mapping ("A record with these details already exists").
    const conflict = await prisma.examSubject.findFirst({
      where: { examId: examSubject.examId, examDate: data.examDate, id: { not: examSubjectId } },
      include: { subject: true },
    });
    if (conflict) {
      throw new HttpError(400, `This class already has a paper scheduled that day (${conflict.subject.name})`);
    }

    // Only the exact slot this edit is vacating counts as "going stale" —
    // scheduling a previously-unscheduled subject for the first time has
    // nothing to orphan, and this must never fire for every edit in a
    // session that's merely had invigilation generated at some point.
    let staleInvigilationWarning: string | null = null;
    if (examSubject.examDate && examSubject.startTime && examSubject.endTime && examSubject.exam.examSessionId) {
      const staleSlot = await prisma.examInvigilation.findFirst({
        where: {
          examSessionId: examSubject.exam.examSessionId,
          examDate: examSubject.examDate,
          startTime: examSubject.startTime,
          endTime: examSubject.endTime,
        },
      });
      if (staleSlot) {
        staleInvigilationWarning =
          'This paper already had an invigilation duty assigned for its old date/time — re-run "Generate invigilation" to update the roster.';
      }
    }

    const updated = await prisma.examSubject.update({
      where: { id: examSubjectId },
      data,
      include: { subject: true },
    });

    return { ...updated, staleInvigilationWarning };
  },
};
