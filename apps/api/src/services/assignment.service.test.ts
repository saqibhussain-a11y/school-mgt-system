import { describe, expect, it } from "vitest";
import { GuardianRelationship, prisma, Role } from "@sms/db";
import { assignmentService } from "./assignment.service";
import {
  createTestAcademicSession,
  createTestClass,
  createTestSchool,
  createTestSection,
  createTestStaff,
  createTestStudent,
  createTestSubject,
  createTestUser,
  withTenant,
} from "../test/helpers";

async function setup() {
  const schoolId = await createTestSchool();
  const session = await createTestAcademicSession(schoolId);
  const classA = await createTestClass(schoolId, session.id);
  const classB = await createTestClass(schoolId, session.id);
  const sectionA = await createTestSection(schoolId, classA.id);

  const admin = await createTestUser(schoolId, Role.SCHOOL_ADMIN);
  const staff = await createTestStaff(schoolId);
  await withTenant(schoolId, () =>
    prisma.teacherAssignment.create({
      data: { schoolId, staffId: staff.id, classId: classA.id, sectionId: sectionA.id },
    }),
  );
  const studentA = await createTestStudent(schoolId, classA.id, sectionA.id);
  const parentUser = await createTestUser(schoolId, Role.PARENT);
  await withTenant(schoolId, async () => {
    const guardian = await prisma.guardian.create({ data: { schoolId, userId: parentUser.id } });
    await prisma.studentGuardian.create({
      data: { schoolId, studentId: studentA.id, guardianId: guardian.id, relationshipType: GuardianRelationship.MOTHER },
    });
  });
  const accountant = await createTestUser(schoolId, Role.ACCOUNTANT);

  for (const klass of [classA, classB]) {
    const subject = await createTestSubject(schoolId, klass.id);
    await withTenant(schoolId, () =>
      prisma.assignment.create({
        data: {
          schoolId,
          classId: klass.id,
          subjectId: subject.id,
          title: `Homework for ${klass.id}`,
          dueDate: new Date("2026-10-20"),
          createdByUserId: admin.id,
        },
      }),
    );
  }

  const viewer = (sub: string, role: Role) => ({ sub, role: role as string });
  return {
    schoolId,
    classA: classA.id,
    classB: classB.id,
    admin: viewer(admin.id, Role.SCHOOL_ADMIN),
    teacher: viewer(staff.userId, Role.TEACHER),
    student: viewer(studentA.userId, Role.STUDENT),
    parent: viewer(parentUser.id, Role.PARENT),
    accountant: viewer(accountant.id, Role.ACCOUNTANT),
  };
}

function classIdsOf(rows: { classId: string }[]) {
  return [...new Set(rows.map((r) => r.classId))];
}

describe("assignmentService.listForViewer — class scoping", () => {
  it("lets admins list every class, or filter to any one", async () => {
    const s = await setup();
    const all = await withTenant(s.schoolId, () => assignmentService.listForViewer(s.schoolId, s.admin));
    expect(classIdsOf(all).sort()).toEqual([s.classA, s.classB].sort());
    const one = await withTenant(s.schoolId, () => assignmentService.listForViewer(s.schoolId, s.admin, s.classB));
    expect(classIdsOf(one)).toEqual([s.classB]);
  });

  it.each(["teacher", "student", "parent"] as const)(
    "limits a %s to their own class when no filter is given",
    async (who) => {
      const s = await setup();
      const rows = await withTenant(s.schoolId, () => assignmentService.listForViewer(s.schoolId, s[who]));
      expect(classIdsOf(rows)).toEqual([s.classA]);
    },
  );

  it.each(["teacher", "student", "parent"] as const)("rejects a %s asking for another class", async (who) => {
    const s = await setup();
    await expect(
      withTenant(s.schoolId, () => assignmentService.listForViewer(s.schoolId, s[who], s.classB)),
    ).rejects.toThrow("permission");
  });

  it("allows a student to filter to their own class", async () => {
    const s = await setup();
    const rows = await withTenant(s.schoolId, () => assignmentService.listForViewer(s.schoolId, s.student, s.classA));
    expect(classIdsOf(rows)).toEqual([s.classA]);
  });

  it("rejects roles that have no assignments access at all", async () => {
    const s = await setup();
    await expect(
      withTenant(s.schoolId, () => assignmentService.listForViewer(s.schoolId, s.accountant)),
    ).rejects.toThrow("permission");
  });
});
