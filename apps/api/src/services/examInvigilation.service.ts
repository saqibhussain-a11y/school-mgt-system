import { prisma, ExamAssignmentSource, DayOfWeek } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";
import { rangesOverlap, dayOfWeekFromDate } from "../lib/examSchedule";

interface CoverageSlot {
  roomId: string;
  examDate: Date;
  startTime: string;
  endTime: string;
  subjectIds: Set<string>;
}

function slotKey(roomId: string, examDate: Date, startTime: string, endTime: string) {
  return `${roomId}|${examDate.toISOString()}|${startTime}|${endTime}`;
}

const invigilationInclude = {
  staff: { include: { user: { select: { firstName: true, lastName: true } } } },
  room: true,
};

export const examInvigilationService = {
  async generate(
    schoolId: string,
    examSessionId: string,
    params: { invigilatorsPerRoom?: number; ignoreRegularTimetableConflicts?: boolean } = {},
  ) {
    const invigilatorsPerRoom = params.invigilatorsPerRoom ?? 1;
    const ignoreRegularTimetableConflicts = params.ignoreRegularTimetableConflicts ?? false;

    const session = await prisma.examSession.findFirst({ where: { id: examSessionId, schoolId } });
    if (!session) throw new HttpError(404, "Exam session not found");

    const seatAllocations = await prisma.examSeatAllocation.findMany({
      where: { schoolId, examSessionId },
    });
    if (seatAllocations.length === 0) {
      throw new HttpError(409, "Seating has not been generated for this exam session yet");
    }

    const linkedExams = await prisma.exam.findMany({
      where: { schoolId, examSessionId },
      include: { examSubjects: true },
    });
    const missingDatesheetSubjectIds = linkedExams.flatMap((e) =>
      e.examSubjects.filter((s) => !s.examDate || !s.startTime || !s.endTime).map((s) => s.id),
    );
    if (missingDatesheetSubjectIds.length > 0) {
      throw new HttpError(409, "Some exam subjects don't have a scheduled date/time yet");
    }
    const examSubjectsByClass = new Map(linkedExams.map((e) => [e.classId, e.examSubjects]));

    // Coverage slots are derived from seated students + their class's
    // scheduled papers, not modeled separately — an invigilator covers a
    // room regardless of which subject is being written there.
    const slots = new Map<string, CoverageSlot>();
    for (const seat of seatAllocations) {
      for (const subject of examSubjectsByClass.get(seat.classId) ?? []) {
        if (!subject.examDate || !subject.startTime || !subject.endTime) continue;
        const key = slotKey(seat.roomId, subject.examDate, subject.startTime, subject.endTime);
        const existing = slots.get(key);
        if (existing) {
          existing.subjectIds.add(subject.subjectId);
        } else {
          slots.set(key, {
            roomId: seat.roomId,
            examDate: subject.examDate,
            startTime: subject.startTime,
            endTime: subject.endTime,
            subjectIds: new Set([subject.subjectId]),
          });
        }
      }
    }

    await prisma.examInvigilation.deleteMany({
      where: { schoolId, examSessionId, source: ExamAssignmentSource.GENERATED },
    });
    const manualRows = await prisma.examInvigilation.findMany({
      where: { schoolId, examSessionId, source: ExamAssignmentSource.MANUAL },
    });

    const staff = await prisma.staff.findMany({ where: { schoolId } });
    const subjectAssignments = await prisma.teacherSubjectAssignment.findMany({ where: { schoolId } });
    const ownTeacherBySubject = new Map<string, Set<string>>();
    for (const a of subjectAssignments) {
      const set = ownTeacherBySubject.get(a.subjectId) ?? new Set<string>();
      set.add(a.staffId);
      ownTeacherBySubject.set(a.subjectId, set);
    }

    const regularSlots = ignoreRegularTimetableConflicts
      ? []
      : await prisma.timetableSlot.findMany({ where: { schoolId }, include: { period: true } });
    const regularByStaffDay = new Map<string, { startTime: string; endTime: string }[]>();
    for (const s of regularSlots) {
      const key = `${s.staffId}|${s.dayOfWeek}`;
      const arr = regularByStaffDay.get(key) ?? [];
      arr.push({ startTime: s.period.startTime, endTime: s.period.endTime });
      regularByStaffDay.set(key, arr);
    }

    // staffId -> list of {examDate (ISO date), startTime, endTime} already
    // committed this pass (seeded from MANUAL rows) — the double-duty check.
    const busyByStaff = new Map<string, { dateKey: string; startTime: string; endTime: string }[]>();
    for (const m of manualRows) {
      const arr = busyByStaff.get(m.staffId) ?? [];
      arr.push({ dateKey: m.examDate.toISOString(), startTime: m.startTime, endTime: m.endTime });
      busyByStaff.set(m.staffId, arr);
    }

    const availableCountByDow = new Map<DayOfWeek | null, number>();
    function availableCountFor(dow: DayOfWeek | null) {
      if (!availableCountByDow.has(dow)) {
        const count = staff.filter((s) => dow === null || s.workingDays.includes(dow)).length;
        availableCountByDow.set(dow, count);
      }
      return availableCountByDow.get(dow)!;
    }

    const orderedSlots = Array.from(slots.values()).sort((a, b) => {
      const dowA = dayOfWeekFromDate(a.examDate);
      const dowB = dayOfWeekFromDate(b.examDate);
      const diff = availableCountFor(dowA) - availableCountFor(dowB);
      if (diff !== 0) return diff;
      return a.examDate.getTime() - b.examDate.getTime();
    });

    const newRows: {
      staffId: string;
      roomId: string;
      examDate: Date;
      startTime: string;
      endTime: string;
    }[] = [];
    const warnings: string[] = [];

    for (const slot of orderedSlots) {
      const dow = dayOfWeekFromDate(slot.examDate);
      const dateKey = slot.examDate.toISOString();

      const avoidSet = new Set<string>();
      for (const subjectId of slot.subjectIds) {
        for (const staffId of ownTeacherBySubject.get(subjectId) ?? []) avoidSet.add(staffId);
      }

      const candidates = staff.filter((s) => {
        if (dow !== null && !s.workingDays.includes(dow)) return false;
        const busy = busyByStaff.get(s.id) ?? [];
        if (busy.some((b) => b.dateKey === dateKey && rangesOverlap(b.startTime, b.endTime, slot.startTime, slot.endTime))) {
          return false;
        }
        if (!ignoreRegularTimetableConflicts && dow !== null) {
          const regular = regularByStaffDay.get(`${s.id}|${dow}`) ?? [];
          if (regular.some((r) => rangesOverlap(r.startTime, r.endTime, slot.startTime, slot.endTime))) {
            return false;
          }
        }
        return true;
      });
      candidates.sort((a, b) => Number(avoidSet.has(a.id)) - Number(avoidSet.has(b.id)));

      const picked = candidates.slice(0, invigilatorsPerRoom);
      for (const p of picked) {
        newRows.push({
          staffId: p.id,
          roomId: slot.roomId,
          examDate: slot.examDate,
          startTime: slot.startTime,
          endTime: slot.endTime,
        });
        const arr = busyByStaff.get(p.id) ?? [];
        arr.push({ dateKey, startTime: slot.startTime, endTime: slot.endTime });
        busyByStaff.set(p.id, arr);
      }
      if (picked.length < invigilatorsPerRoom) {
        warnings.push(
          `Room coverage on ${slot.examDate.toISOString().slice(0, 10)} ${slot.startTime}-${slot.endTime}: only ${picked.length}/${invigilatorsPerRoom} invigilator(s) assigned`,
        );
      }
    }

    if (newRows.length > 0) {
      await prisma.examInvigilation.createMany({
        data: newRows.map((r) => ({ schoolId, examSessionId, source: ExamAssignmentSource.GENERATED, ...r })),
      });
    }

    return { createdCount: newRows.length, warnings };
  },

  listForSession(schoolId: string, examSessionId: string) {
    return prisma.examInvigilation.findMany({
      where: { schoolId, examSessionId },
      include: invigilationInclude,
      orderBy: [{ examDate: "asc" }, { startTime: "asc" }, { roomId: "asc" }],
    });
  },

  async myDuties(schoolId: string, userId: string) {
    const staff = await prisma.staff.findFirst({ where: { schoolId, userId } });
    if (!staff) return [];
    return prisma.examInvigilation.findMany({
      where: { schoolId, staffId: staff.id },
      include: { room: true, examSession: true },
      orderBy: [{ examDate: "asc" }, { startTime: "asc" }],
    });
  },

  async assign(
    schoolId: string,
    examSessionId: string,
    data: { staffId: string; roomId: string; examDate: Date; startTime: string; endTime: string },
  ) {
    const [session, staff, room] = await Promise.all([
      prisma.examSession.findFirst({ where: { id: examSessionId, schoolId } }),
      prisma.staff.findFirst({ where: { id: data.staffId, schoolId } }),
      prisma.room.findFirst({ where: { id: data.roomId, schoolId } }),
    ]);
    if (!session) throw new HttpError(404, "Exam session not found");
    if (!staff) throw new HttpError(404, "Staff member not found");
    if (!room) throw new HttpError(404, "Room not found");

    const conflict = await prisma.examInvigilation.findFirst({
      where: { schoolId, staffId: data.staffId, examDate: data.examDate },
    });
    if (
      conflict &&
      rangesOverlap(conflict.startTime, conflict.endTime, data.startTime, data.endTime)
    ) {
      throw new HttpError(409, "This staff member is already assigned to another room at an overlapping time");
    }

    return prisma.examInvigilation.create({
      data: { schoolId, examSessionId, source: ExamAssignmentSource.MANUAL, ...data },
      include: invigilationInclude,
    });
  },

  async remove(schoolId: string, id: string) {
    const existing = await prisma.examInvigilation.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    await prisma.examInvigilation.delete({ where: { id } });
    return existing;
  },
};
