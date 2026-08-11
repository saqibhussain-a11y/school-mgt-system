import { prisma, Prisma, Role } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";
import { dayOfWeekFromDate, toUtcDateKey, toUtcMidnight } from "../lib/examSchedule";
import { getAssignedClassIdsForUser } from "./teacherAssignment.service";

interface DatesheetExam {
  id: string;
  examSubjects: { id: string; examDate: Date | null }[];
}

interface RequestUser {
  sub: string;
  role: string;
}

interface MovableSibling {
  id: string;
  className: string;
  subjectName: string;
  newExamDate: Date;
  newStartTime: string;
  newEndTime: string;
  oldStartTime: string;
  oldEndTime: string;
}

interface SkippedSibling {
  id: string;
  className: string;
  subjectName: string;
  reason: string;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

// The sibling-matching key is the calendar day being vacated, never
// Subject.id — Subject is class-scoped (@@unique([classId, name])), so
// Grade 4's "Mathematics" and Grade 5's "Mathematics" are always different
// rows. What generate() actually keeps aligned across a session is the day
// (each class's next-unscheduled paper lands on the same day), not which
// subject that happens to be — see the comment on generate() below.
//
// Deliberately does NOT pull an already-divergent sibling back into line —
// ExamSubject has no source/provenance flag (see generate()'s comment for
// why), so there is no way to tell "drifted by accident" from "deliberately
// rescheduled for a real reason," and every comparable generator in this
// feature area (ExamSeatAllocation.source, ExamInvigilation.source,
// TimetableSlot.source) exists specifically to protect a manual override
// from exactly this kind of silent clobber. A sibling is only ever a
// candidate if it was sharing the primary's exact old date right up until
// this edit.
async function discoverSiblingMoves(
  schoolId: string,
  primary: {
    examId: string;
    examDate: Date | null;
    startTime: string | null;
    endTime: string | null;
    exam: { examSessionId: string | null };
  },
  target: { examDate: Date; startTime: string; endTime: string },
  user: RequestUser,
): Promise<{ movable: MovableSibling[]; skipped: SkippedSibling[] }> {
  if (!primary.exam.examSessionId || !primary.examDate) {
    // No session, or this is a first-time scheduling (nothing to desync
    // from yet) — structurally excludes the schedule-time-dialog flow.
    return { movable: [], skipped: [] };
  }

  const oldKey = toUtcDateKey(primary.examDate);
  const targetKey = toUtcDateKey(target.examDate);

  const siblings = await prisma.examSubject.findMany({
    where: {
      exam: { examSessionId: primary.exam.examSessionId, schoolId, id: { not: primary.examId } },
      examDate: primary.examDate,
    },
    include: { subject: true, exam: { include: { class: true } } },
  });

  const assignedClassIds = user.role === Role.TEACHER ? await getAssignedClassIdsForUser(schoolId, user.sub) : null;

  const movable: MovableSibling[] = [];
  const skipped: SkippedSibling[] = [];

  for (const sib of siblings) {
    const className = sib.exam.class.name;
    const subjectName = sib.subject.name;

    if (assignedClassIds && !assignedClassIds.includes(sib.exam.classId)) {
      skipped.push({ id: sib.id, className, subjectName, reason: "you don't have permission to change this class's schedule" });
      continue;
    }

    if (targetKey === oldKey) {
      // Time-only edit — the date isn't changing, so there's no
      // @@unique([examId, examDate]) risk for this sibling at all. Only
      // sync a sibling that was at the exact same old time; one already
      // staggered was staggered on purpose.
      if (sib.startTime === primary.startTime && sib.endTime === primary.endTime) {
        movable.push({
          id: sib.id,
          className,
          subjectName,
          newExamDate: target.examDate,
          newStartTime: target.startTime,
          newEndTime: target.endTime,
          oldStartTime: sib.startTime!,
          oldEndTime: sib.endTime!,
        });
      } else {
        skipped.push({ id: sib.id, className, subjectName, reason: "already scheduled at a different time and was left alone" });
      }
      continue;
    }

    const conflict = await prisma.examSubject.findFirst({
      where: { examId: sib.examId, examDate: target.examDate, id: { not: sib.id } },
      include: { subject: true },
    });
    if (conflict) {
      skipped.push({
        id: sib.id,
        className,
        subjectName,
        reason: `already has ${conflict.subject.name} scheduled that day — its old date will then have only the other linked class(es) sitting`,
      });
      continue;
    }

    // New date always follows the primary. New time follows too, but only
    // if this sibling was at the primary's exact old time — a sibling
    // already staggered in time keeps its own time through the move.
    const wasSameTimeAsPrimary = sib.startTime === primary.startTime && sib.endTime === primary.endTime;
    movable.push({
      id: sib.id,
      className,
      subjectName,
      newExamDate: target.examDate,
      newStartTime: wasSameTimeAsPrimary ? target.startTime : sib.startTime!,
      newEndTime: wasSameTimeAsPrimary ? target.endTime : sib.endTime!,
      oldStartTime: sib.startTime!,
      oldEndTime: sib.endTime!,
    });
  }

  return { movable, skipped };
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

  // Read-only preview for the drag/time-edit confirmation dialog — calls the
  // exact same discovery the commit path uses, so the preview can never
  // promise something the commit then does differently.
  async previewSiblingSync(
    schoolId: string,
    examSubjectId: string,
    query: { examDate: Date; startTime: string; endTime: string },
    user: RequestUser,
  ) {
    const examSubject = await prisma.examSubject.findFirst({
      where: { id: examSubjectId, schoolId },
      include: { exam: true },
    });
    if (!examSubject) throw new HttpError(404, "Exam subject not found");

    const targetDate = toUtcMidnight(query.examDate);
    const { movable, skipped } = await discoverSiblingMoves(
      schoolId,
      examSubject,
      { examDate: targetDate, startTime: query.startTime, endTime: query.endTime },
      user,
    );

    return {
      movable: movable.map((m) => ({
        id: m.id,
        className: m.className,
        subjectName: m.subjectName,
        newExamDate: m.newExamDate,
        newStartTime: m.newStartTime,
        newEndTime: m.newEndTime,
      })),
      skipped,
    };
  },

  async updateSchedule(
    schoolId: string,
    examSubjectId: string,
    data: { examDate: Date; startTime: string; endTime: string; syncSiblings?: boolean },
    user: RequestUser,
  ) {
    const examSubject = await prisma.examSubject.findFirst({
      where: { id: examSubjectId, schoolId },
      include: { exam: { include: { examSession: true } } },
    });
    if (!examSubject) throw new HttpError(404, "Exam subject not found");

    const targetDate = toUtcMidnight(data.examDate);

    const rangeStart = examSubject.exam.examSession?.startDate ?? examSubject.exam.startDate;
    const rangeEnd = examSubject.exam.examSession?.endDate ?? examSubject.exam.endDate;
    if (targetDate < rangeStart || targetDate > rangeEnd) {
      throw new HttpError(400, "The scheduled date must fall within the exam's date range");
    }
    if (dayOfWeekFromDate(targetDate) === null) {
      throw new HttpError(400, "Exams cannot be scheduled on a Sunday");
    }

    // Proactive check ahead of the @@unique([examId, examDate]) DB
    // constraint, purely for a clearer error message than the generic P2002
    // mapping ("A record with these details already exists").
    const conflict = await prisma.examSubject.findFirst({
      where: { examId: examSubject.examId, examDate: targetDate, id: { not: examSubjectId } },
      include: { subject: true },
    });
    if (conflict) {
      throw new HttpError(400, `This class already has a paper scheduled that day (${conflict.subject.name})`);
    }

    const oldExamDate = examSubject.examDate;
    const oldStartTime = examSubject.startTime;
    const oldEndTime = examSubject.endTime;

    const { movable, skipped } = await discoverSiblingMoves(
      schoolId,
      examSubject,
      { examDate: targetDate, startTime: data.startTime, endTime: data.endTime },
      user,
    );

    const syncedSiblings: { id: string; className: string; subjectName: string }[] = [];
    let skippedSiblings: SkippedSibling[] = skipped;

    if (data.syncSiblings && movable.length > 0) {
      try {
        await prisma.$transaction([
          prisma.examSubject.update({
            where: { id: examSubjectId },
            data: { examDate: targetDate, startTime: data.startTime, endTime: data.endTime },
          }),
          ...movable.map((m) =>
            prisma.examSubject.update({
              where: { id: m.id },
              data: { examDate: m.newExamDate, startTime: m.newStartTime, endTime: m.newEndTime },
            }),
          ),
        ]);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          throw new HttpError(
            409,
            "Another change to one of the linked classes' schedules landed at the same time — reload the datesheet and try again.",
          );
        }
        throw err;
      }
      syncedSiblings.push(...movable.map((m) => ({ id: m.id, className: m.className, subjectName: m.subjectName })));
    } else {
      await prisma.examSubject.update({
        where: { id: examSubjectId },
        data: { examDate: targetDate, startTime: data.startTime, endTime: data.endTime },
      });
      // Not syncing (either not requested, or nothing was actually
      // movable) — fold anything that WOULD have moved into the disclosed
      // skip list, so "just this class" is never silent about siblings.
      if (!data.syncSiblings && movable.length > 0) {
        skippedSiblings = [
          ...movable.map((m) => ({
            id: m.id,
            className: m.className,
            subjectName: m.subjectName,
            reason: "left on its own schedule (only this class was moved)",
          })),
          ...skipped,
        ];
      }
    }

    // Stale invigilation: every mover (and the primary) vacated the exact
    // same old date, so one query at that date covers all of them — check
    // it against the set of old (startTime, endTime) pairs actually vacated.
    let staleInvigilationWarning: string | null = null;
    if (oldExamDate && oldStartTime && oldEndTime && examSubject.exam.examSessionId) {
      const movedSiblingIds = new Set(syncedSiblings.map((s) => s.id));
      const oldTimePairs = new Set([`${oldStartTime}|${oldEndTime}`]);
      for (const m of movable) {
        if (movedSiblingIds.has(m.id)) oldTimePairs.add(`${m.oldStartTime}|${m.oldEndTime}`);
      }
      const staleSlots = await prisma.examInvigilation.findMany({
        where: { examSessionId: examSubject.exam.examSessionId, examDate: oldExamDate },
      });
      const anyStale = staleSlots.some((s) => oldTimePairs.has(`${s.startTime}|${s.endTime}`));
      if (anyStale) {
        staleInvigilationWarning =
          "This paper (or a linked class's paper that moved with it) already had an invigilation duty assigned for its old date/time — re-run \"Generate invigilation\" to update the roster.";
      }
    }

    const updated = await prisma.examSubject.findUniqueOrThrow({
      where: { id: examSubjectId },
      include: { subject: true },
    });

    return { ...updated, staleInvigilationWarning, syncedSiblings, skippedSiblings };
  },
};
