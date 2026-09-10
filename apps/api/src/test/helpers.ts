import { randomUUID } from "crypto";
import { prisma, Role, runWithTenant } from "@sms/db";

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

export async function createTestStaff(schoolId: string, overrides: { designation?: string } = {}) {
  const user = await createTestUser(schoolId, Role.TEACHER);
  return withTenant(schoolId, () =>
    prisma.staff.create({
      data: { schoolId, userId: user.id, designation: overrides.designation ?? "Teacher" },
    }),
  );
}

export async function createTestClassSection(schoolId: string) {
  return withTenant(schoolId, async () => {
    const session = await prisma.academicSession.create({
      data: { schoolId, name: "2026", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") },
    });
    const klass = await prisma.class.create({
      data: { schoolId, academicSessionId: session.id, name: `Class-${randomUUID().slice(0, 6)}` },
    });
    const section = await prisma.section.create({ data: { schoolId, classId: klass.id, name: "A" } });
    return { classId: klass.id, sectionId: section.id };
  });
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
