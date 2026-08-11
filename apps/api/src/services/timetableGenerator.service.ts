import { prisma, DayOfWeek, RoomType, TimetableSlotSource } from "@sms/db";

const ALL_DAYS: DayOfWeek[] = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
];

const DAY_LABELS: Record<string, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
};

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
  sectionSize: number;
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
  roomCapacityById: Map<string, number | null>;
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
    roomCapacityById,
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
  const notices: string[] = [];
  const slots: SlotToCreate[] = [];
  let unscheduledPeriodCount = 0;

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
      unscheduledPeriodCount += g.count;
      continue;
    }

    let candidateRoomIds: string[];
    if (g.requiresLab) {
      candidateRoomIds = g.subjectRoomId
        ? [g.subjectRoomId, ...labRoomIds.filter((id) => id !== g.subjectRoomId)]
        : labRoomIds;
      if (candidateRoomIds.length === 0) {
        warnings.push(`${g.subjectLabel} for ${g.sectionLabel}: no lab room available — 0/${g.count} scheduled`);
        unscheduledPeriodCount += g.count;
        continue;
      }
    } else {
      candidateRoomIds = [g.subjectRoomId, g.classDefaultRoomId, ...generalRoomIds].filter(
        (id, i, arr): id is string => !!id && arr.indexOf(id) === i,
      );
      if (candidateRoomIds.length === 0) {
        warnings.push(`${g.subjectLabel} for ${g.sectionLabel}: no room available — 0/${g.count} scheduled`);
        unscheduledPeriodCount += g.count;
        continue;
      }
    }

    // Room-capacity awareness: reorder (never filter) the candidate list so a
    // room that actually fits the section is preferred over one that's merely
    // available — best-fit among adequate rooms, least-overflow among
    // undersized ones, with unknown capacity (null) never disqualifying.
    // Computed once per group, not per occurrence/day/period.
    let orderedCandidateRoomIds = candidateRoomIds;
    const tooSmallRoomIds = new Set<string>();
    let tierAEmpty = false;
    if (g.sectionSize > 0) {
      const bucketOf = (roomId: string) => {
        const cap = roomCapacityById.get(roomId) ?? null;
        if (cap == null) return 1;
        return cap >= g.sectionSize ? 0 : 2;
      };
      candidateRoomIds.forEach((id) => {
        if (bucketOf(id) === 2) tooSmallRoomIds.add(id);
      });
      tierAEmpty = tooSmallRoomIds.size === candidateRoomIds.length;
      orderedCandidateRoomIds = candidateRoomIds
        .map((id, index) => ({ id, index, bucket: bucketOf(id), cap: roomCapacityById.get(id) ?? null }))
        .sort((a, b) => {
          if (a.bucket !== b.bucket) return a.bucket - b.bucket;
          if (a.bucket === 0 && a.cap !== b.cap) return (a.cap ?? 0) - (b.cap ?? 0); // best-fit: smallest sufficient first
          if (a.bucket === 2 && a.cap !== b.cap) return (b.cap ?? 0) - (a.cap ?? 0); // least-overflow: largest first
          return a.index - b.index; // preserves designated-room-first order within a bucket
        })
        .map((entry) => entry.id);
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
    const repeatDays: DayOfWeek[] = [];
    const undersizedPlacements: { roomId: string; cap: number }[] = [];

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

          const room = orderedCandidateRoomIds.find((roomId) => !roomBusy.has(key(roomId, day, period.id)));
          if (!room) continue;

          const repeatedDay = daysUsedForPair.has(day);
          if (repeatedDay && daysUsedForPair.size < usableDays.length) repeatDays.push(day);
          if (tooSmallRoomIds.has(room)) {
            undersizedPlacements.push({ roomId: room, cap: roomCapacityById.get(room) ?? 0 });
          }

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
      unscheduledPeriodCount += g.count - scheduled;
    }

    if (g.sectionSize > 0 && tierAEmpty && scheduled > 0) {
      const largestCandidateCapacity = Math.max(
        0,
        ...candidateRoomIds.map((id) => roomCapacityById.get(id) ?? 0),
      );
      notices.push(
        `${g.subjectLabel} for ${g.sectionLabel}: no ${g.requiresLab ? "lab room" : "room"} is large enough for this section (${g.sectionSize} students; largest available seats ${largestCandidateCapacity}) — all ${scheduled} period${scheduled === 1 ? "" : "s"} placed in undersized rooms.`,
      );
    } else if (undersizedPlacements.length > 0) {
      const minUsedCapacity = Math.min(...undersizedPlacements.map((p) => p.cap));
      notices.push(
        `${g.subjectLabel} for ${g.sectionLabel}: ${undersizedPlacements.length} of ${scheduled} period${scheduled === 1 ? "" : "s"} placed in a room smaller than the section (${g.sectionSize} students; smallest used seats ${minUsedCapacity}) — no larger room was free at that time.`,
      );
    }

    if (repeatDays.length > 0) {
      const dayList = Array.from(new Set(repeatDays))
        .map((d) => DAY_LABELS[d] ?? d)
        .join(", ");
      notices.push(
        `${g.subjectLabel} for ${g.sectionLabel}: ${repeatDays.length} period${repeatDays.length === 1 ? "" : "s"} had to double up on a day already used (${dayList}) — no other working day was free.`,
      );
    }
  }

  return { slots, warnings, notices, unscheduledPeriodCount };
}

export const timetableGeneratorService = {
  async generate(schoolId: string, options: { classId?: string } = {}) {
    const sections = await prisma.section.findMany({
      where: { schoolId, ...(options.classId ? { classId: options.classId } : {}) },
      include: { class: { include: { subjects: true } } },
    });
    if (sections.length === 0) {
      return { createdCount: 0, warnings: ["No sections found to generate a timetable for."], notices: [], unscheduledPeriodCount: 0 };
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
        notices: [],
        unscheduledPeriodCount: 0,
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
    const roomCapacityById = new Map<string, number | null>(rooms.map((r) => [r.id, r.capacity]));

    const sectionIds = sections.map((s) => s.id);

    // One query for every in-scope section's currently-enrolled headcount,
    // reduced in memory (matches this file's existing findMany+reduce idiom
    // — there's no groupBy usage anywhere else in this codebase).
    const studentRows = await prisma.student.findMany({
      where: { schoolId, sectionId: { in: sectionIds }, status: "ACTIVE" },
      select: { sectionId: true },
    });
    const sizeBySectionId = new Map<string, number>();
    for (const row of studentRows) {
      if (!row.sectionId) continue;
      sizeBySectionId.set(row.sectionId, (sizeBySectionId.get(row.sectionId) ?? 0) + 1);
    }

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
          sectionSize: sizeBySectionId.get(section.id) ?? 0,
        });
      }
    }
    if (groups.length === 0) {
      return {
        createdCount: 0,
        warnings: ["No subjects with periods-per-week configured for these classes."],
        notices: [],
        unscheduledPeriodCount: 0,
      };
    }

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

    let best: {
      slots: SlotToCreate[];
      warnings: string[];
      notices: string[];
      unscheduledPeriodCount: number;
    } | null = null;
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const result = runGreedyPass({
        schoolId,
        groups,
        periods,
        staffById,
        teachersBySubject,
        labRoomIds,
        generalRoomIds,
        roomCapacityById,
        seedStaffBusy,
        seedRoomBusy,
        seedSectionBusy,
        seedStaffWeeklyCount,
      });
      // Lexicographic: fewer truly-unscheduled periods wins outright; only
      // fall back to notice count as a tiebreak between two attempts that
      // scheduled the same number of periods. Never let a smaller notice
      // count outrank a more complete schedule (see plan for the
      // counterexample this was built to avoid).
      if (
        !best ||
        result.unscheduledPeriodCount < best.unscheduledPeriodCount ||
        (result.unscheduledPeriodCount === best.unscheduledPeriodCount && result.notices.length < best.notices.length)
      ) {
        best = result;
      }
      if (best.unscheduledPeriodCount === 0 && best.notices.length === 0) break;
    }

    const finalSlots = best!.slots;
    if (finalSlots.length > 0) {
      await prisma.$transaction(finalSlots.map((s) => prisma.timetableSlot.create({ data: s })));
    }

    const notices = [...best!.notices];
    if (groups.some((g) => g.sectionSize > 0)) {
      const usedRoomIds = new Set(finalSlots.map((s) => s.roomId));
      const unknownCapacityRoomCount = Array.from(usedRoomIds).filter(
        (roomId) => (roomCapacityById.get(roomId) ?? null) == null,
      ).length;
      if (unknownCapacityRoomCount > 0) {
        const plural = unknownCapacityRoomCount === 1;
        notices.push(
          `${unknownCapacityRoomCount} room${plural ? "" : "s"} used in this timetable ${plural ? "has" : "have"} no capacity set — the generator couldn't check whether ${plural ? "it fits its section" : "they fit their sections"}.`,
        );
      }
    }

    return {
      createdCount: finalSlots.length,
      warnings: best!.warnings,
      notices,
      unscheduledPeriodCount: best!.unscheduledPeriodCount,
    };
  },
};
