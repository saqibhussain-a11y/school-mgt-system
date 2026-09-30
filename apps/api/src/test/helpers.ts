import { randomUUID } from "crypto";
import { DayOfWeek, prisma, Role, RoomType, runWithTenant, SeatingStrategy } from "@sms/db";

// Integration-test fixtures — these hit the real database configured by
// DATABASE_URL (the same one `npm run dev`/CI use), not a mock. Each test
// creates its own School so fixtures never collide across test files or
// runs; nothing here truncates tables, so local runs accumulate rows the
// same way manually poking around the app in dev would. Fine for this
// codebase's scale — revisit if that ever becomes a real problem.

export async function createTestSchool() {
  const school = await prisma.school.create({
    data: { name: `Test School ${randomUUID()}`, subdomain: `test-${randomUUID()}` },
  });
  return school.id;
}

// Wraps a callback in the same AsyncLocalStorage tenant context the real
// `authenticate` middleware establishes per-request (see
// packages/db/src/tenantContext.ts) — exercises the tenant-scoping Prisma
// extension for real instead of only testing services under a context that
// never occurs outside a real HTTP request.
export function withTenant<T>(schoolId: string, fn: () => Promise<T>): Promise<T> {
  return runWithTenant(schoolId, fn);
}

export function createTestUser(schoolId: string, role: Role, overrides: Partial<{ email: string }> = {}) {
  return withTenant(schoolId, () =>
    prisma.user.create({
      data: {
        schoolId,
        email: overrides.email ?? `${randomUUID()}@test.local`,
        passwordHash: "test-hash",
        role,
        firstName: "Test",
        lastName: "User",
      },
    }),
  );
}

export async function createTestStaff(
  schoolId: string,
  overrides: {
    designation?: string;
    workingDays?: DayOfWeek[];
    periodsAvailableFrom?: number | null;
    periodsAvailableTo?: number | null;
    maxPeriodsPerWeek?: number | null;
  } = {},
) {
  const user = await createTestUser(schoolId, Role.TEACHER);
  return withTenant(schoolId, () =>
    prisma.staff.create({
      data: {
        schoolId,
        userId: user.id,
        designation: overrides.designation ?? "Teacher",
        // Defaults to all six working days, all periods, no weekly cap — a
        // fully-available teacher — so tests that don't care about
        // availability constraints don't have to spell them out every time.
        workingDays: overrides.workingDays ?? [
          DayOfWeek.MONDAY,
          DayOfWeek.TUESDAY,
          DayOfWeek.WEDNESDAY,
          DayOfWeek.THURSDAY,
          DayOfWeek.FRIDAY,
          DayOfWeek.SATURDAY,
        ],
        periodsAvailableFrom: overrides.periodsAvailableFrom,
        periodsAvailableTo: overrides.periodsAvailableTo,
        maxPeriodsPerWeek: overrides.maxPeriodsPerWeek,
      },
    }),
  );
}

export function createTestRoom(
  schoolId: string,
  overrides: { name?: string; type?: RoomType; capacity?: number | null } = {},
) {
  return withTenant(schoolId, () =>
    prisma.room.create({
      data: {
        schoolId,
        name: overrides.name ?? `Room-${randomUUID().slice(0, 6)}`,
        type: overrides.type ?? RoomType.GENERAL,
        capacity: overrides.capacity === undefined ? 30 : overrides.capacity,
      },
    }),
  );
}

export function createTestRoomColumn(schoolId: string, roomId: string, columnNumber: number, seatCapacity: number) {
  return withTenant(schoolId, () =>
    prisma.roomColumn.create({ data: { schoolId, roomId, columnNumber, seatCapacity } }),
  );
}

export function createTestPeriod(
  schoolId: string,
  periodNumber: number,
  overrides: { startTime?: string; endTime?: string; isBreak?: boolean } = {},
) {
  return withTenant(schoolId, () =>
    prisma.period.create({
      data: {
        schoolId,
        periodNumber,
        startTime: overrides.startTime ?? `${String(8 + periodNumber).padStart(2, "0")}:00`,
        endTime: overrides.endTime ?? `${String(9 + periodNumber).padStart(2, "0")}:00`,
        isBreak: overrides.isBreak ?? false,
      },
    }),
  );
}

export function createTestSubject(
  schoolId: string,
  classId: string,
  overrides: { name?: string; periodsPerWeek?: number; requiresLab?: boolean; roomId?: string | null } = {},
) {
  return withTenant(schoolId, () =>
    prisma.subject.create({
      data: {
        schoolId,
        classId,
        name: overrides.name ?? `Subject-${randomUUID().slice(0, 6)}`,
        periodsPerWeek: overrides.periodsPerWeek ?? 1,
        requiresLab: overrides.requiresLab ?? false,
        roomId: overrides.roomId ?? undefined,
      },
    }),
  );
}

export function assignTeacherToSubject(schoolId: string, staffId: string, subjectId: string) {
  return withTenant(schoolId, () =>
    prisma.teacherSubjectAssignment.create({ data: { schoolId, staffId, subjectId } }),
  );
}

export function createTestExamSession(
  schoolId: string,
  academicSessionId: string,
  overrides: { name?: string; seatingStrategy?: SeatingStrategy; startDate?: Date; endDate?: Date } = {},
) {
  return withTenant(schoolId, () =>
    prisma.examSession.create({
      data: {
        schoolId,
        academicSessionId,
        name: overrides.name ?? `Exam Session ${randomUUID().slice(0, 6)}`,
        seatingStrategy: overrides.seatingStrategy ?? SeatingStrategy.INTERLEAVED,
        startDate: overrides.startDate ?? new Date("2026-10-01"),
        endDate: overrides.endDate ?? new Date("2026-10-10"),
      },
    }),
  );
}

export function createTestExam(
  schoolId: string,
  classId: string,
  academicSessionId: string,
  overrides: { name?: string; examSessionId?: string; startDate?: Date; endDate?: Date } = {},
) {
  return withTenant(schoolId, () =>
    prisma.exam.create({
      data: {
        schoolId,
        classId,
        academicSessionId,
        examSessionId: overrides.examSessionId,
        name: overrides.name ?? `Exam-${randomUUID().slice(0, 6)}`,
        startDate: overrides.startDate ?? new Date("2026-10-01"),
        endDate: overrides.endDate ?? new Date("2026-10-10"),
      },
    }),
  );
}

export function createTestAcademicSession(schoolId: string) {
  return withTenant(schoolId, () =>
    prisma.academicSession.create({
      // Randomized name — AcademicSession is unique on (schoolId, name), and
      // several tests create more than one class/section under the same
      // school (e.g. cross-class exam seating), which would otherwise collide.
      data: {
        schoolId,
        name: `2026-${randomUUID().slice(0, 6)}`,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
      },
    }),
  );
}

export function createTestClass(schoolId: string, academicSessionId: string, overrides: { name?: string; defaultRoomId?: string } = {}) {
  return withTenant(schoolId, () =>
    prisma.class.create({
      data: {
        schoolId,
        academicSessionId,
        name: overrides.name ?? `Class-${randomUUID().slice(0, 6)}`,
        defaultRoomId: overrides.defaultRoomId,
      },
    }),
  );
}

export function createTestSection(schoolId: string, classId: string, name = "A") {
  return withTenant(schoolId, () => prisma.section.create({ data: { schoolId, classId, name } }));
}

export async function createTestClassSection(schoolId: string) {
  const session = await createTestAcademicSession(schoolId);
  const klass = await createTestClass(schoolId, session.id);
  const section = await createTestSection(schoolId, klass.id);
  return { academicSessionId: session.id, classId: klass.id, sectionId: section.id };
}

export async function createTestStudent(schoolId: string, classId: string, sectionId: string) {
  const user = await createTestUser(schoolId, Role.STUDENT);
  return withTenant(schoolId, () =>
    prisma.student.create({
      data: {
        schoolId,
        userId: user.id,
        classId,
        sectionId,
        admissionNo: randomUUID().slice(0, 8),
        dob: new Date("2010-01-01"),
      },
    }),
  );
}

export function createTestFeeStructure(schoolId: string, classId: string, data: { category?: string; amount: number }) {
  return withTenant(schoolId, () =>
    prisma.feeStructure.create({
      data: { schoolId, classId, category: data.category ?? "Tuition", amount: data.amount },
    }),
  );
}
