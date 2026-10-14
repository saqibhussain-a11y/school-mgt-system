import { describe, expect, it } from "vitest";
import { GuardianRelationship, prisma, Role } from "@sms/db";
import { diaryService } from "./diary.service";
import {
  createTestClassSection,
  createTestSchool,
  createTestSection,
  createTestStaff,
  createTestStudent,
  createTestUser,
  withTenant,
} from "../test/helpers";

const PAGE = { page: 1, pageSize: 25 } as const;
const TODAY = new Date("2026-10-14T00:00:00Z");

async function createParentOf(schoolId: string, studentId: string) {
  const user = await createTestUser(schoolId, Role.PARENT);
  await withTenant(schoolId, async () => {
    const guardian = await prisma.guardian.create({ data: { schoolId, userId: user.id } });
    await prisma.studentGuardian.create({
      data: { schoolId, studentId, guardianId: guardian.id, relationshipType: GuardianRelationship.FATHER },
    });
  });
  return { sub: user.id, role: Role.PARENT as string };
}

async function setup() {
  const schoolId = await createTestSchool();
  const { classId, sectionId } = await createTestClassSection(schoolId);
  const otherSection = await createTestSection(schoolId, classId, "B");
  const studentA = await createTestStudent(schoolId, classId, sectionId);
  const studentB = await createTestStudent(schoolId, classId, sectionId);
  const studentOther = await createTestStudent(schoolId, classId, otherSection.id);
  const parentA = await createParentOf(schoolId, studentA.id);
  const parentB = await createParentOf(schoolId, studentB.id);
  const parentOther = await createParentOf(schoolId, studentOther.id);

  const staff = await createTestStaff(schoolId);
  await withTenant(schoolId, () =>
    prisma.teacherAssignment.create({ data: { schoolId, staffId: staff.id, classId, sectionId } }),
  );
  const teacher = { sub: staff.userId, role: Role.TEACHER as string };
  const admin = { sub: (await createTestUser(schoolId, Role.SCHOOL_ADMIN)).id, role: Role.SCHOOL_ADMIN as string };

  return {
    schoolId,
    sectionId,
    otherSectionId: otherSection.id,
    studentA,
    studentB,
    studentOther,
    parentA,
    parentB,
    parentOther,
    teacher,
    admin,
  };
}

function run<T>(schoolId: string, fn: () => Promise<T>) {
  return withTenant(schoolId, fn);
}

describe("diaryService — posting permissions", () => {
  it("lets a teacher post to a section they teach, and only lists those sections", async () => {
    const s = await setup();
    const sections = await run(s.schoolId, () => diaryService.listPostableSections(s.schoolId, s.teacher));
    expect(sections.map((x) => x.id)).toEqual([s.sectionId]);

    const entry = await run(s.schoolId, () =>
      diaryService.create(s.schoolId, s.teacher, { sectionId: s.sectionId, date: TODAY, content: "Bring crayons" }),
    );
    expect(entry.studentId).toBeNull();
  });

  it("rejects a teacher posting to a section they don't teach", async () => {
    const s = await setup();
    await expect(
      run(s.schoolId, () =>
        diaryService.create(s.schoolId, s.teacher, { sectionId: s.otherSectionId, date: TODAY, content: "Hi" }),
      ),
    ).rejects.toThrow("sections you teach");
  });

  it("lets an admin post to any section", async () => {
    const s = await setup();
    const sections = await run(s.schoolId, () => diaryService.listPostableSections(s.schoolId, s.admin));
    expect(sections).toHaveLength(2);
    await run(s.schoolId, () =>
      diaryService.create(s.schoolId, s.admin, { sectionId: s.otherSectionId, date: TODAY, content: "Assembly" }),
    );
  });

  it("rejects a personal remark for a student outside the section", async () => {
    const s = await setup();
    await expect(
      run(s.schoolId, () =>
        diaryService.create(s.schoolId, s.teacher, {
          sectionId: s.sectionId,
          studentId: s.studentOther.id,
          date: TODAY,
          content: "Well done",
        }),
      ),
    ).rejects.toThrow("isn't an active member of this section");
  });
});

describe("diaryService — who sees what", () => {
  it("shows section notes to every family in the section, and personal remarks only to that child's family", async () => {
    const s = await setup();
    await run(s.schoolId, async () => {
      await diaryService.create(s.schoolId, s.teacher, { sectionId: s.sectionId, date: TODAY, content: "Field trip" });
      await diaryService.create(s.schoolId, s.teacher, {
        sectionId: s.sectionId,
        studentId: s.studentA.id,
        date: TODAY,
        content: "Great reading today",
      });
    });

    const forA = await run(s.schoolId, () => diaryService.listForStudent(s.schoolId, s.parentA, s.studentA.id, PAGE));
    const forB = await run(s.schoolId, () => diaryService.listForStudent(s.schoolId, s.parentB, s.studentB.id, PAGE));
    const forOther = await run(s.schoolId, () =>
      diaryService.listForStudent(s.schoolId, s.parentOther, s.studentOther.id, PAGE),
    );

    expect(forA.total).toBe(2);
    expect(forB.total).toBe(1);
    expect((forB.data[0] as { content: string }).content).toBe("Field trip");
    expect(forOther.total).toBe(0);
  });

  it("blocks a parent from reading another child's diary", async () => {
    const s = await setup();
    await expect(
      run(s.schoolId, () => diaryService.listForStudent(s.schoolId, s.parentB, s.studentA.id, PAGE)),
    ).rejects.toThrow("permission");
  });

  it("lets a student read only their own diary", async () => {
    const s = await setup();
    const studentViewer = { sub: s.studentA.userId, role: Role.STUDENT as string };
    await run(s.schoolId, () => diaryService.listForStudent(s.schoolId, studentViewer, s.studentA.id, PAGE));
    await expect(
      run(s.schoolId, () => diaryService.listForStudent(s.schoolId, studentViewer, s.studentB.id, PAGE)),
    ).rejects.toThrow("permission");
  });

  it("blocks a teacher from listing a section they don't teach", async () => {
    const s = await setup();
    await expect(
      run(s.schoolId, () => diaryService.listForSection(s.schoolId, s.teacher, s.otherSectionId, PAGE)),
    ).rejects.toThrow("sections you teach");
  });
});

describe("diaryService — acknowledgments", () => {
  it("counts parent acknowledgments against the right recipient total, idempotently", async () => {
    const s = await setup();
    const sectionNote = await run(s.schoolId, () =>
      diaryService.create(s.schoolId, s.teacher, { sectionId: s.sectionId, date: TODAY, content: "Exam Friday" }),
    );
    const personal = await run(s.schoolId, () =>
      diaryService.create(s.schoolId, s.teacher, {
        sectionId: s.sectionId,
        studentId: s.studentA.id,
        date: TODAY,
        content: "Needs a new notebook",
      }),
    );

    await run(s.schoolId, async () => {
      await diaryService.acknowledge(s.schoolId, s.parentA.sub, sectionNote.id);
      await diaryService.acknowledge(s.schoolId, s.parentA.sub, sectionNote.id);
      await diaryService.acknowledge(s.schoolId, s.parentA.sub, personal.id);
    });

    const list = await run(s.schoolId, () => diaryService.listForSection(s.schoolId, s.teacher, s.sectionId, PAGE));
    const byId = new Map(
      (list.data as { id: string; acknowledgedCount: number; recipientCount: number }[]).map((e) => [e.id, e]),
    );
    expect(byId.get(sectionNote.id)).toMatchObject({ acknowledgedCount: 1, recipientCount: 2 });
    expect(byId.get(personal.id)).toMatchObject({ acknowledgedCount: 1, recipientCount: 1 });

    const forA = await run(s.schoolId, () => diaryService.listForStudent(s.schoolId, s.parentA, s.studentA.id, PAGE));
    expect((forA.data as { acknowledged: boolean }[]).every((e) => e.acknowledged)).toBe(true);
  });

  it("rejects acknowledging a note not addressed to the parent's child", async () => {
    const s = await setup();
    const personal = await run(s.schoolId, () =>
      diaryService.create(s.schoolId, s.teacher, {
        sectionId: s.sectionId,
        studentId: s.studentA.id,
        date: TODAY,
        content: "Private",
      }),
    );
    await expect(
      run(s.schoolId, () => diaryService.acknowledge(s.schoolId, s.parentB.sub, personal.id)),
    ).rejects.toThrow("isn't addressed to your child");
    await expect(
      run(s.schoolId, () => diaryService.acknowledge(s.schoolId, s.parentOther.sub, personal.id)),
    ).rejects.toThrow("isn't addressed to your child");
  });
});

describe("diaryService — editing and notifications", () => {
  it("lets only the author or an admin edit or delete", async () => {
    const s = await setup();
    const otherStaff = await createTestStaff(s.schoolId);
    const otherTeacher = { sub: otherStaff.userId, role: Role.TEACHER as string };
    const entry = await run(s.schoolId, () =>
      diaryService.create(s.schoolId, s.teacher, { sectionId: s.sectionId, date: TODAY, content: "Typo" }),
    );

    await expect(
      run(s.schoolId, () => diaryService.updateContent(s.schoolId, otherTeacher, entry.id, "Hacked")),
    ).rejects.toThrow("Only the author");

    const updated = await run(s.schoolId, () => diaryService.updateContent(s.schoolId, s.teacher, entry.id, "Fixed"));
    expect(updated.content).toBe("Fixed");

    await run(s.schoolId, () => diaryService.remove(s.schoolId, s.admin, entry.id));
    const gone = await run(s.schoolId, () => prisma.diaryEntry.findFirst({ where: { id: entry.id } }));
    expect(gone).toBeNull();
  });

  it("notifies the students and parents a note is addressed to, and nobody else", async () => {
    const s = await setup();
    await run(s.schoolId, () =>
      diaryService.create(s.schoolId, s.teacher, {
        sectionId: s.sectionId,
        studentId: s.studentA.id,
        date: TODAY,
        content: "Lovely painting",
      }),
    );
    const notified = await run(s.schoolId, () =>
      prisma.notification.findMany({ where: { schoolId: s.schoolId, type: "diary" }, select: { userId: true } }),
    );
    expect(notified.map((n) => n.userId).sort()).toEqual([s.studentA.userId, s.parentA.sub].sort());
  });
});
