import { describe, expect, it } from "vitest";
import { DayOfWeek, RoomType, TimetableSlotSource, prisma } from "@sms/db";
import { timetableGeneratorService } from "./timetableGenerator.service";
import {
  assignTeacherToSubject,
  createTestClass,
  createTestClassSection,
  createTestPeriod,
  createTestRoom,
  createTestSchool,
  createTestSection,
  createTestStaff,
  createTestStudent,
  createTestSubject,
  withTenant,
} from "../test/helpers";

function slotsFor(schoolId: string) {
  return withTenant(schoolId, () => prisma.timetableSlot.findMany({ where: { schoolId } }));
}

describe("timetableGeneratorService.generate — infeasible/empty inputs", () => {
  it("reports no sections found when there are none to schedule", async () => {
    const schoolId = await createTestSchool();
    const result = await timetableGeneratorService.generate(schoolId);
    expect(result).toMatchObject({ createdCount: 0, unscheduledPeriodCount: 0 });
    expect(result.warnings).toEqual(["No sections found to generate a timetable for."]);
  });

  it("reports no periods configured when the school hasn't set up its period grid", async () => {
    const schoolId = await createTestSchool();
    await createTestClassSection(schoolId);
    const result = await timetableGeneratorService.generate(schoolId);
    expect(result.createdCount).toBe(0);
    expect(result.warnings[0]).toMatch(/No periods are configured/);
  });

  it("reports no schedulable subjects when nothing has periodsPerWeek > 0", async () => {
    const schoolId = await createTestSchool();
    const { classId } = await createTestClassSection(schoolId);
    await createTestPeriod(schoolId, 1);
    await createTestSubject(schoolId, classId, { periodsPerWeek: 0 });

    const result = await timetableGeneratorService.generate(schoolId);
    expect(result.createdCount).toBe(0);
    expect(result.warnings[0]).toMatch(/No subjects with periods-per-week configured/);
  });
});

describe("timetableGeneratorService.generate — basic scheduling", () => {
  it("schedules every occurrence when a qualified teacher and room are available", async () => {
    const schoolId = await createTestSchool();
    const { classId, sectionId } = await createTestClassSection(schoolId);
    for (let i = 1; i <= 4; i++) await createTestPeriod(schoolId, i);
    const subject = await createTestSubject(schoolId, classId, { periodsPerWeek: 2 });
    const teacher = await createTestStaff(schoolId);
    await assignTeacherToSubject(schoolId, teacher.id, subject.id);
    await createTestRoom(schoolId, { capacity: 30 });

    const result = await timetableGeneratorService.generate(schoolId);
    expect(result.createdCount).toBe(2);
    expect(result.unscheduledPeriodCount).toBe(0);
    expect(result.warnings).toEqual([]);

    const slots = await slotsFor(schoolId);
    expect(slots).toHaveLength(2);
    expect(slots.every((s) => s.sectionId === sectionId && s.staffId === teacher.id)).toBe(true);
    expect(slots.every((s) => s.source === TimetableSlotSource.GENERATED)).toBe(true);
  });

  it("warns and leaves periods unscheduled when no teacher is qualified for a subject", async () => {
    const schoolId = await createTestSchool();
    const { classId } = await createTestClassSection(schoolId);
    await createTestPeriod(schoolId, 1);
    await createTestSubject(schoolId, classId, { periodsPerWeek: 1, name: "Orphan Subject" });
    await createTestRoom(schoolId, { capacity: 30 });
    // No TeacherSubjectAssignment created for this subject at all.

    const result = await timetableGeneratorService.generate(schoolId);
    expect(result.createdCount).toBe(0);
    expect(result.unscheduledPeriodCount).toBe(1);
    expect(result.warnings[0]).toMatch(/no available qualified teacher/);
  });

  it("warns when a lab subject has no lab room available", async () => {
    const schoolId = await createTestSchool();
    const { classId } = await createTestClassSection(schoolId);
    await createTestPeriod(schoolId, 1);
    const subject = await createTestSubject(schoolId, classId, { periodsPerWeek: 1, requiresLab: true });
    const teacher = await createTestStaff(schoolId);
    await assignTeacherToSubject(schoolId, teacher.id, subject.id);
    await createTestRoom(schoolId, { type: RoomType.GENERAL, capacity: 30 }); // no LAB room

    const result = await timetableGeneratorService.generate(schoolId);
    expect(result.createdCount).toBe(0);
    expect(result.unscheduledPeriodCount).toBe(1);
    expect(result.warnings[0]).toMatch(/no lab room available/);
  });

  it("warns when no room at all is available for a non-lab subject", async () => {
    const schoolId = await createTestSchool();
    const { classId } = await createTestClassSection(schoolId);
    await createTestPeriod(schoolId, 1);
    const subject = await createTestSubject(schoolId, classId, { periodsPerWeek: 1 });
    const teacher = await createTestStaff(schoolId);
    await assignTeacherToSubject(schoolId, teacher.id, subject.id);
    // No rooms created at all.

    const result = await timetableGeneratorService.generate(schoolId);
    expect(result.createdCount).toBe(0);
    expect(result.warnings[0]).toMatch(/no room available/);
  });
});

describe("timetableGeneratorService.generate — no double-booking", () => {
  it("never assigns the same teacher, section, or room to two slots in the same day+period, across sections sharing teachers", async () => {
    const schoolId = await createTestSchool();
    const { classId } = await createTestClassSection(schoolId);
    const sectionB = await createTestSection(schoolId, classId, "B");
    for (let i = 1; i <= 4; i++) await createTestPeriod(schoolId, i);

    const math = await createTestSubject(schoolId, classId, { periodsPerWeek: 3, name: "Math" });
    const science = await createTestSubject(schoolId, classId, { periodsPerWeek: 2, name: "Science", requiresLab: true });
    const teacherMath = await createTestStaff(schoolId);
    const teacherScience = await createTestStaff(schoolId);
    await assignTeacherToSubject(schoolId, teacherMath.id, math.id);
    await assignTeacherToSubject(schoolId, teacherScience.id, science.id);
    await createTestRoom(schoolId, { type: RoomType.GENERAL, capacity: 30 });
    await createTestRoom(schoolId, { type: RoomType.GENERAL, capacity: 30 });
    await createTestRoom(schoolId, { type: RoomType.LAB, capacity: 30 });

    // Both sections (default "A" from createTestClassSection, plus "B") share
    // the class's Math/Science subjects and thus the same two teachers.
    const result = await timetableGeneratorService.generate(schoolId);
    expect(result.unscheduledPeriodCount).toBe(0);
    expect(result.createdCount).toBe(2 * (3 + 2));

    const slots = await slotsFor(schoolId);
    expect(slots).toHaveLength(10);

    const staffKeys = new Set<string>();
    const sectionKeys = new Set<string>();
    const roomKeys = new Set<string>();
    for (const s of slots) {
      const staffKey = `${s.staffId}|${s.dayOfWeek}|${s.periodId}`;
      const sectionKey = `${s.sectionId}|${s.dayOfWeek}|${s.periodId}`;
      const roomKey = `${s.roomId}|${s.dayOfWeek}|${s.periodId}`;
      expect(staffKeys.has(staffKey)).toBe(false);
      expect(sectionKeys.has(sectionKey)).toBe(false);
      expect(roomKeys.has(roomKey)).toBe(false);
      staffKeys.add(staffKey);
      sectionKeys.add(sectionKey);
      roomKeys.add(roomKey);
    }
    void sectionB;
  });

  it("treats a pre-existing MANUAL slot as fixed occupancy and refuses to double-book its teacher", async () => {
    const schoolId = await createTestSchool();
    const { classId, sectionId } = await createTestClassSection(schoolId);
    const period = await createTestPeriod(schoolId, 1);
    const teacher = await createTestStaff(schoolId, {
      workingDays: [DayOfWeek.MONDAY],
      periodsAvailableFrom: 1,
      periodsAvailableTo: 1,
    });
    const room = await createTestRoom(schoolId, { capacity: 30 });
    // periodsPerWeek: 0 so the generator doesn't also try to schedule its
    // own occurrences for this subject — we only want its manual slot to
    // occupy the teacher's one available day+period, nothing else.
    const otherSubject = await createTestSubject(schoolId, classId, { periodsPerWeek: 0, name: "Already Booked" });
    const newSubject = await createTestSubject(schoolId, classId, { periodsPerWeek: 1, name: "Needs Same Teacher" });
    await assignTeacherToSubject(schoolId, teacher.id, newSubject.id);

    // Manually book this teacher's only available day+period for an
    // unrelated subject — this MANUAL row is never touched by generate().
    await withTenant(schoolId, () =>
      prisma.timetableSlot.create({
        data: {
          schoolId,
          classId,
          sectionId,
          subjectId: otherSubject.id,
          staffId: teacher.id,
          dayOfWeek: DayOfWeek.MONDAY,
          periodId: period.id,
          roomId: room.id,
          source: TimetableSlotSource.MANUAL,
        },
      }),
    );

    const result = await timetableGeneratorService.generate(schoolId);
    // The new subject can't be placed — the teacher's only slot is taken.
    expect(result.createdCount).toBe(0);
    expect(result.unscheduledPeriodCount).toBe(1);
    expect(result.warnings[0]).toMatch(/Needs Same Teacher.*only 0\/1 periods scheduled/);

    const slots = await slotsFor(schoolId);
    expect(slots).toHaveLength(1);
    expect(slots[0].source).toBe(TimetableSlotSource.MANUAL);
    expect(slots[0].subjectId).toBe(otherSubject.id);
  });
});

describe("timetableGeneratorService.generate — day/period spreading", () => {
  it("spreads repeated occurrences of a subject across different days when days are available", async () => {
    const schoolId = await createTestSchool();
    const { classId } = await createTestClassSection(schoolId);
    for (let i = 1; i <= 2; i++) await createTestPeriod(schoolId, i);
    const subject = await createTestSubject(schoolId, classId, { periodsPerWeek: 2 });
    const teacher = await createTestStaff(schoolId); // all 6 days available
    await assignTeacherToSubject(schoolId, teacher.id, subject.id);
    await createTestRoom(schoolId, { capacity: 30 });

    const result = await timetableGeneratorService.generate(schoolId);
    expect(result.createdCount).toBe(2);
    expect(result.notices.some((n) => n.includes("already used"))).toBe(false);

    const slots = await slotsFor(schoolId);
    const days = new Set(slots.map((s) => s.dayOfWeek));
    expect(days.size).toBe(2); // two occurrences landed on two distinct days
  });

  it("doubles up on the same day without a notice when the teacher genuinely only works one day", async () => {
    // No other day was ever an option here, so this isn't a wasteful
    // repeat — the generator's repeatDays notice is deliberately suppressed
    // in this case (see the `daysUsedForPair.size < usableDays.length`
    // guard in timetableGenerator.service.ts).
    const schoolId = await createTestSchool();
    const { classId } = await createTestClassSection(schoolId);
    for (let i = 1; i <= 2; i++) await createTestPeriod(schoolId, i);
    const subject = await createTestSubject(schoolId, classId, { periodsPerWeek: 2 });
    const teacher = await createTestStaff(schoolId, { workingDays: [DayOfWeek.MONDAY] });
    await assignTeacherToSubject(schoolId, teacher.id, subject.id);
    await createTestRoom(schoolId, { capacity: 30 });

    const result = await timetableGeneratorService.generate(schoolId);
    expect(result.createdCount).toBe(2);
    expect(result.unscheduledPeriodCount).toBe(0);
    expect(result.notices.some((n) => n.includes("already used"))).toBe(false);

    const slots = await slotsFor(schoolId);
    expect(slots.every((s) => s.dayOfWeek === DayOfWeek.MONDAY)).toBe(true);
    // Still two distinct periods on that one day, not the same period twice.
    expect(new Set(slots.map((s) => s.periodId)).size).toBe(2);
  });

  it("notices a same-day repeat when another day was nominally free but blocked (e.g. by room contention)", async () => {
    const schoolId = await createTestSchool();
    const { classId, sectionId } = await createTestClassSection(schoolId);
    const period1 = await createTestPeriod(schoolId, 1);
    const period2 = await createTestPeriod(schoolId, 2);
    const subject = await createTestSubject(schoolId, classId, { periodsPerWeek: 2 });
    const teacher = await createTestStaff(schoolId, {
      workingDays: [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY],
    });
    await assignTeacherToSubject(schoolId, teacher.id, subject.id);
    const room = await createTestRoom(schoolId, { capacity: 30 }); // the only room

    // Occupy the only room for all of Tuesday and Wednesday via manual slots
    // so Monday is the only day genuinely free at room level — but the
    // teacher's workingDays make Tuesday/Wednesday nominally available too.
    const fillerStaff = await createTestStaff(schoolId);
    const blockerSubject = await createTestSubject(schoolId, classId, { periodsPerWeek: 0, name: "Blocker" });
    await withTenant(schoolId, () =>
      prisma.timetableSlot.createMany({
        data: [DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY].flatMap((day) =>
          [period1, period2].map((p) => ({
            schoolId,
            classId,
            sectionId,
            subjectId: blockerSubject.id,
            staffId: fillerStaff.id,
            dayOfWeek: day,
            periodId: p.id,
            roomId: room.id,
            source: TimetableSlotSource.MANUAL,
          })),
        ),
      }),
    );

    const result = await timetableGeneratorService.generate(schoolId);
    expect(result.createdCount).toBe(2);
    expect(result.unscheduledPeriodCount).toBe(0);
    expect(result.notices.some((n) => n.includes("double up on a day already used (Monday)"))).toBe(true);

    const generatedSlots = await withTenant(schoolId, () =>
      prisma.timetableSlot.findMany({ where: { schoolId, source: TimetableSlotSource.GENERATED } }),
    );
    expect(generatedSlots).toHaveLength(2);
    expect(generatedSlots.every((s) => s.dayOfWeek === DayOfWeek.MONDAY)).toBe(true);
  });
});

describe("timetableGeneratorService.generate — teacher weekly cap", () => {
  it("stops scheduling once a teacher's maxPeriodsPerWeek is reached", async () => {
    const schoolId = await createTestSchool();
    const { classId } = await createTestClassSection(schoolId);
    for (let i = 1; i <= 3; i++) await createTestPeriod(schoolId, i);
    const subject = await createTestSubject(schoolId, classId, { periodsPerWeek: 2 });
    const teacher = await createTestStaff(schoolId, { maxPeriodsPerWeek: 1 });
    await assignTeacherToSubject(schoolId, teacher.id, subject.id);
    await createTestRoom(schoolId, { capacity: 30 });

    const result = await timetableGeneratorService.generate(schoolId);
    expect(result.createdCount).toBe(1);
    expect(result.unscheduledPeriodCount).toBe(1);
    expect(result.warnings[0]).toMatch(/only 1\/2 periods scheduled/);

    const slots = await slotsFor(schoolId);
    expect(slots).toHaveLength(1);
  });
});

describe("timetableGeneratorService.generate — room-capacity awareness", () => {
  it("prefers a room that actually fits the section over a smaller one that's merely free", async () => {
    const schoolId = await createTestSchool();
    const { classId, sectionId } = await createTestClassSection(schoolId);
    await createTestPeriod(schoolId, 1);
    const subject = await createTestSubject(schoolId, classId, { periodsPerWeek: 1 });
    const teacher = await createTestStaff(schoolId);
    await assignTeacherToSubject(schoolId, teacher.id, subject.id);
    const smallRoom = await createTestRoom(schoolId, { capacity: 5 });
    const bigRoom = await createTestRoom(schoolId, { capacity: 40 });
    for (let i = 0; i < 30; i++) await createTestStudent(schoolId, classId, sectionId);

    const result = await timetableGeneratorService.generate(schoolId);
    expect(result.createdCount).toBe(1);
    expect(result.notices.some((n) => n.includes("undersized"))).toBe(false);

    const slots = await slotsFor(schoolId);
    expect(slots[0].roomId).toBe(bigRoom.id);
    expect(slots[0].roomId).not.toBe(smallRoom.id);
  });

  it("notices when no room is large enough and still places the section in the best available one", async () => {
    const schoolId = await createTestSchool();
    const { classId, sectionId } = await createTestClassSection(schoolId);
    await createTestPeriod(schoolId, 1);
    const subject = await createTestSubject(schoolId, classId, { periodsPerWeek: 1 });
    const teacher = await createTestStaff(schoolId);
    await assignTeacherToSubject(schoolId, teacher.id, subject.id);
    const onlyRoom = await createTestRoom(schoolId, { capacity: 5 });
    for (let i = 0; i < 30; i++) await createTestStudent(schoolId, classId, sectionId);

    const result = await timetableGeneratorService.generate(schoolId);
    expect(result.createdCount).toBe(1);
    expect(result.notices.some((n) => n.includes("no") && n.includes("large enough"))).toBe(true);

    const slots = await slotsFor(schoolId);
    expect(slots[0].roomId).toBe(onlyRoom.id);
  });

  it("notices when a used room has no capacity set at all, for a section with enrolled students", async () => {
    const schoolId = await createTestSchool();
    const { classId, sectionId } = await createTestClassSection(schoolId);
    await createTestPeriod(schoolId, 1);
    const subject = await createTestSubject(schoolId, classId, { periodsPerWeek: 1 });
    const teacher = await createTestStaff(schoolId);
    await assignTeacherToSubject(schoolId, teacher.id, subject.id);
    await createTestRoom(schoolId, { capacity: null });
    await createTestStudent(schoolId, classId, sectionId);

    const result = await timetableGeneratorService.generate(schoolId);
    expect(result.createdCount).toBe(1);
    expect(result.notices.some((n) => n.includes("no capacity set"))).toBe(true);
  });
});

describe("timetableGeneratorService.generate — classId scoping", () => {
  it("only regenerates sections belonging to the requested class, leaving other classes untouched", async () => {
    const schoolId = await createTestSchool();
    const { classId: classA, sectionId: sectionA, academicSessionId } = await createTestClassSection(schoolId);
    const classB = await createTestClass(schoolId, academicSessionId);
    const sectionB = await createTestSection(schoolId, classB.id);
    await createTestPeriod(schoolId, 1);
    await createTestPeriod(schoolId, 2);

    const subjectA = await createTestSubject(schoolId, classA, { periodsPerWeek: 1, name: "A-Subject" });
    const subjectB = await createTestSubject(schoolId, classB.id, { periodsPerWeek: 1, name: "B-Subject" });
    const teacherA = await createTestStaff(schoolId);
    const teacherB = await createTestStaff(schoolId);
    await assignTeacherToSubject(schoolId, teacherA.id, subjectA.id);
    await assignTeacherToSubject(schoolId, teacherB.id, subjectB.id);
    await createTestRoom(schoolId, { capacity: 30 });
    await createTestRoom(schoolId, { capacity: 30 });

    const result = await timetableGeneratorService.generate(schoolId, { classId: classA });
    expect(result.createdCount).toBe(1);

    const slots = await slotsFor(schoolId);
    expect(slots).toHaveLength(1);
    expect(slots[0].sectionId).toBe(sectionA);
    void sectionB;
  });
});
