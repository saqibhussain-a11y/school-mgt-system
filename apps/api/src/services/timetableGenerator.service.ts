import { prisma, DayOfWeek, RoomType, TimetableSlotSource } from "@sms/db";

const ALL_DAYS: DayOfWeek[] = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
];

// Greedy, most-constrained-first, with a random-restart (not real
// backtracking) — real school timetabling is NP-hard in general, so this is
// a deliberate, disclosed v1 simplification. "Free periods are added only if
// necessary" is the spec's own request for graceful degradation: an
// unfillable occurrence is reported as a warning, never a hard failure.
const ATTEMPTS = 5;

interface Group {
  sectionId: string;
  sectionLabel: string;
  classId: string;
  subjectId: string;
  subjectLabel: string;
  count: number;
  requiresLab: boolean;
  subjectRoomId: string | null;
  classDefaultRoomId: string | null;
}

interface StaffAvailability {
  workingDays: DayOfWeek[];
  periodsAvailableFrom: number | null;
  periodsAvailableTo: number | null;
  maxPeriodsPerWeek: number | null;
}

interface PeriodRow {
  id: string;
  periodNumber: number;
}

interface SlotToCreate {
  schoolId: string;
  classId: string;
  sectionId: string;
  subjectId: string;
  staffId: string;
  dayOfWeek: DayOfWeek;
  periodId: string;
  roomId: string;
  source: typeof TimetableSlotSource.GENERATED;
}

function key(...parts: string[]) {
  return parts.join("|");
}

function runGreedyPass(params: {
  schoolId: string;
  groups: Group[];
  periods: PeriodRow[];
  staffById: Map<string, StaffAvailability>;
  teachersBySubject: Map<string, string[]>;
  labRoomIds: string[];
  generalRoomIds: string[];
  seedStaffBusy: Set<string>;
  seedRoomBusy: Set<string>;
  seedSectionBusy: Set<string>;
  seedStaffWeeklyCount: Map<string, number>;
}) {
  const {
    schoolId,
    groups,
    periods,
    staffById,
    teachersBySubject,
    labRoomIds,
    generalRoomIds,
    seedStaffBusy,
    seedRoomBusy,
    seedSectionBusy,
    seedStaffWeeklyCount,
  } = params;

  const staffBusy = new Set(seedStaffBusy);
  const roomBusy = new Set(seedRoomBusy);
  const sectionBusy = new Set(seedSectionBusy);
  const staffWeeklyCount = new Map(seedStaffWeeklyCount);
  const staffDayCount = new Map<string, number>();

  const warnings: string[] = [];
  const slots: SlotToCreate[] = [];

  // Most-constrained-first (lab subjects, then fewest qualified teachers,
  // then higher periodsPerWeek), with a small random jitter so re-running
  // this pass produces genuinely different orderings, not just tie-breaks.
  const scored = groups.map((g) => {
    const labPenalty = g.requiresLab ? 0 : 1_000_000;
    const teacherCount = teachersBySubject.get(g.subjectId)?.length ?? 0;
    const score = labPenalty + teacherCount * 1000 - g.count + Math.random() * 50;
    return { g, score };
  });
  scored.sort((a, b) => a.score - b.score);

  for (const { g } of scored) {
    const candidates = (teachersBySubject.get(g.subjectId) ?? []).filter((staffId) => {
      const avail = staffById.get(staffId);
      return avail && avail.workingDays.length > 0;
    });

    const teacherId = candidates.find((staffId) => {
      const avail = staffById.get(staffId)!;
      const cap = avail.maxPeriodsPerWeek;
      return cap == null || (staffWeeklyCount.get(staffId) ?? 0) < cap;
    });

    if (!teacherId) {
      warnings.push(`${g.subjectLabel} for ${g.sectionLabel}: no available qualified teacher — 0/${g.count} scheduled`);
      continue;
    }

    let candidateRoomIds: string[];
    if (g.requiresLab) {
      candidateRoomIds = g.subjectRoomId
        ? [g.subjectRoomId, ...labRoomIds.filter((id) => id !== g.subjectRoomId)]
        : labRoomIds;
      if (candidateRoomIds.length === 0) {
        warnings.push(`${g.subjectLabel} for ${g.sectionLabel}: no lab room available — 0/${g.count} scheduled`);
        continue;
      }
    } else {
      candidateRoomIds = [g.subjectRoomId, g.classDefaultRoomId, ...generalRoomIds].filter(
        (id, i, arr): id is string => !!id && arr.indexOf(id) === i,
      );
      if (candidateRoomIds.length === 0) {
        warnings.push(`${g.subjectLabel} for ${g.sectionLabel}: no room available — 0/${g.count} scheduled`);
        continue;
      }
    }

    const avail = staffById.get(teacherId)!;
    const usableDays = ALL_DAYS.filter((d) => avail.workingDays.includes(d));
    const usablePeriods =
      avail.periodsAvailableFrom != null && avail.periodsAvailableTo != null
        ? periods.filter((p) => p.periodNumber >= avail.periodsAvailableFrom! && p.periodNumber <= avail.periodsAvailableTo!)
        : periods;

    const daysUsedForPair = new Set<DayOfWeek>();
    const periodsUsedForPair = new Set<string>();
    let scheduled = 0;

    for (let occurrence = 0; occurrence < g.count; occurrence++) {
      const cap = avail.maxPeriodsPerWeek;
      if (cap != null && (staffWeeklyCount.get(teacherId) ?? 0) >= cap) break;

      const orderedDays = [...usableDays].sort((a, b) => {
        const aUsed = daysUsedForPair.has(a) ? 1 : 0;
        const bUsed = daysUsedForPair.has(b) ? 1 : 0;
        if (aUsed !== bUsed) return aUsed - bUsed;
        const aCount = staffDayCount.get(key(teacherId, a)) ?? 0;
        const bCount = staffDayCount.get(key(teacherId, b)) ?? 0;
        return aCount - bCount;
      });

      // Same soft-spread idea as days: a class shouldn't have this subject
      // land at the same time-of-day on every occurrence (e.g. always
      // Period 3), so prefer a period not yet used for this pair before
      // falling back to a repeat.
      const orderedPeriods = [...usablePeriods].sort((a, b) => {
        const aUsed = periodsUsedForPair.has(a.id) ? 1 : 0;
        const bUsed = periodsUsedForPair.has(b.id) ? 1 : 0;
        if (aUsed !== bUsed) return aUsed - bUsed;
        return a.periodNumber - b.periodNumber;
      });

      let placed = false;
      for (const day of orderedDays) {
        for (const period of orderedPeriods) {
          if (sectionBusy.has(key(g.sectionId, day, period.id))) continue;
          if (staffBusy.has(key(teacherId, day, period.id))) continue;

          const room = candidateRoomIds.find((roomId) => !roomBusy.has(key(roomId, day, period.id)));
          if (!room) continue;

          sectionBusy.add(key(g.sectionId, day, period.id));
          staffBusy.add(key(teacherId, day, period.id));
          roomBusy.add(key(room, day, period.id));
          staffWeeklyCount.set(teacherId, (staffWeeklyCount.get(teacherId) ?? 0) + 1);
          staffDayCount.set(key(teacherId, day), (staffDayCount.get(key(teacherId, day)) ?? 0) + 1);
          daysUsedForPair.add(day);
          periodsUsedForPair.add(period.id);

          slots.push({
            schoolId,
            classId: g.classId,
            sectionId: g.sectionId,
            subjectId: g.subjectId,
            staffId: teacherId,
            dayOfWeek: day,
            periodId: period.id,
            roomId: room,
            source: TimetableSlotSource.GENERATED,
          });
          scheduled++;
          placed = true;
          break;
        }
        if (placed) break;
      }
      if (!placed) break; // no point trying further occurrences if this one failed
    }

    if (scheduled < g.count) {
      warnings.push(`${g.subjectLabel} for ${g.sectionLabel}: only ${scheduled}/${g.count} periods scheduled`);
    }
  }

  return { slots, warnings };
}

export const timetableGeneratorService = {
  async generate(schoolId: string, options: { classId?: string } = {}) {
    const sections = await prisma.section.findMany({
      where: { schoolId, ...(options.classId ? { classId: options.classId } : {}) },
      include: { class: { include: { subjects: true } } },
    });
    if (sections.length === 0) {
      return { createdCount: 0, warnings: ["No sections found to generate a timetable for."] };
    }

    const periods: PeriodRow[] = await prisma.period.findMany({
      where: { schoolId, isBreak: false },
      orderBy: { periodNumber: "asc" },
      select: { id: true, periodNumber: true },
    });
    if (periods.length === 0) {
      return {
        createdCount: 0,
        warnings: ["No periods are configured for this school yet — set up the period grid first."],
      };
    }

    const staffRows = await prisma.staff.findMany({ where: { schoolId } });
    const staffById = new Map<string, StaffAvailability>(
      staffRows.map((s) => [
        s.id,
        {
          workingDays: s.workingDays,
          periodsAvailableFrom: s.periodsAvailableFrom,
          periodsAvailableTo: s.periodsAvailableTo,
          maxPeriodsPerWeek: s.maxPeriodsPerWeek,
        },
      ]),
    );

    const subjectAssignments = await prisma.teacherSubjectAssignment.findMany({ where: { schoolId } });
    const teachersBySubject = new Map<string, string[]>();
    for (const a of subjectAssignments) {
      const list = teachersBySubject.get(a.subjectId) ?? [];
      list.push(a.staffId);
      teachersBySubject.set(a.subjectId, list);
    }

    const rooms = await prisma.room.findMany({ where: { schoolId } });
    const labRoomIds = rooms.filter((r) => r.type === RoomType.LAB).map((r) => r.id);
    const generalRoomIds = rooms.filter((r) => r.type === RoomType.GENERAL).map((r) => r.id);

    const groups: Group[] = [];
    for (const section of sections) {
      for (const subject of section.class.subjects) {
        if (subject.periodsPerWeek <= 0) continue;
        groups.push({
          sectionId: section.id,
          sectionLabel: `${section.class.name}-${section.name}`,
          classId: section.classId,
          subjectId: subject.id,
          subjectLabel: subject.name,
          count: subject.periodsPerWeek,
          requiresLab: subject.requiresLab,
          subjectRoomId: subject.roomId,
          classDefaultRoomId: section.class.defaultRoomId,
        });
      }
    }
    if (groups.length === 0) {
      return { createdCount: 0, warnings: ["No subjects with periods-per-week configured for these classes."] };
    }

    const sectionIds = sections.map((s) => s.id);

    // Wipe only GENERATED slots in scope — hand-edited MANUAL slots (in or
    // out of scope) are left untouched and treated as fixed occupancy below.
    await prisma.timetableSlot.deleteMany({
      where: { schoolId, sectionId: { in: sectionIds }, source: TimetableSlotSource.GENERATED },
    });

    const remainingSlots = await prisma.timetableSlot.findMany({ where: { schoolId } });
    const seedStaffBusy = new Set<string>();
    const seedRoomBusy = new Set<string>();
    const seedSectionBusy = new Set<string>();
    const seedStaffWeeklyCount = new Map<string, number>();
    for (const slot of remainingSlots) {
      seedStaffBusy.add(key(slot.staffId, slot.dayOfWeek, slot.periodId));
      seedRoomBusy.add(key(slot.roomId, slot.dayOfWeek, slot.periodId));
      seedSectionBusy.add(key(slot.sectionId, slot.dayOfWeek, slot.periodId));
      seedStaffWeeklyCount.set(slot.staffId, (seedStaffWeeklyCount.get(slot.staffId) ?? 0) + 1);
    }

    let best: { slots: SlotToCreate[]; warnings: string[] } | null = null;
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const result = runGreedyPass({
        schoolId,
        groups,
        periods,
        staffById,
        teachersBySubject,
        labRoomIds,
        generalRoomIds,
        seedStaffBusy,
        seedRoomBusy,
        seedSectionBusy,
        seedStaffWeeklyCount,
      });
      if (!best || result.warnings.length < best.warnings.length) best = result;
      if (best.warnings.length === 0) break;
    }

    const finalSlots = best!.slots;
    if (finalSlots.length > 0) {
      await prisma.$transaction(finalSlots.map((s) => prisma.timetableSlot.create({ data: s })));
    }

    return { createdCount: finalSlots.length, warnings: best!.warnings };
  },
};
