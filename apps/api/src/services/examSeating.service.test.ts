import { describe, expect, it } from "vitest";
import { ExamAssignmentSource, SeatingStrategy, prisma } from "@sms/db";
import { examSeatingService } from "./examSeating.service";
import { HttpError } from "../middleware/errorHandler";
import {
  createTestClassSection,
  createTestExam,
  createTestExamSession,
  createTestRoom,
  createTestRoomColumn,
  createTestSchool,
  createTestSection,
  createTestStudent,
  withTenant,
} from "../test/helpers";

async function createStudents(schoolId: string, classId: string, sectionId: string, count: number) {
  const students = [];
  for (let i = 0; i < count; i++) {
    students.push(await createTestStudent(schoolId, classId, sectionId));
  }
  return students;
}

describe("examSeatingService.generate — session resolution", () => {
  it("requires an examId or examSessionId", async () => {
    const schoolId = await createTestSchool();
    await expect(examSeatingService.generate(schoolId, {})).rejects.toThrow(HttpError);
  });

  it("404s when the exam doesn't exist for this school", async () => {
    const schoolId = await createTestSchool();
    await expect(examSeatingService.generate(schoolId, { examId: "does-not-exist" })).rejects.toThrow(
      "Exam not found",
    );
  });

  it("lazily creates a 1:1 ExamSession for a standalone exam on first use", async () => {
    const schoolId = await createTestSchool();
    const { classId, sectionId, academicSessionId } = await createTestClassSection(schoolId);
    await createStudents(schoolId, classId, sectionId, 2);
    const exam = await createTestExam(schoolId, classId, academicSessionId);
    const room = await createTestRoom(schoolId, { capacity: 5 });

    const result = await examSeatingService.generate(schoolId, { examId: exam.id, roomIds: [room.id] });
    expect(result.createdCount).toBe(2);

    const updatedExam = await withTenant(schoolId, () => prisma.exam.findFirstOrThrow({ where: { id: exam.id } }));
    expect(updatedExam.examSessionId).not.toBeNull();
  });

  it("refuses to auto-generate for a COLUMN_BLOCKED session", async () => {
    const schoolId = await createTestSchool();
    const { classId, sectionId, academicSessionId } = await createTestClassSection(schoolId);
    await createStudents(schoolId, classId, sectionId, 2);
    const session = await createTestExamSession(schoolId, academicSessionId, {
      seatingStrategy: SeatingStrategy.COLUMN_BLOCKED,
    });
    await createTestExam(schoolId, classId, academicSessionId, { examSessionId: session.id });
    const room = await createTestRoom(schoolId, { capacity: 5 });

    await expect(
      examSeatingService.generate(schoolId, { examSessionId: session.id, roomIds: [room.id] }),
    ).rejects.toThrow(/column-blocked seating/);
  });
});

describe("examSeatingService.generate — room selection and capacity", () => {
  it("requires at least one room, with none selected and none previously used", async () => {
    const schoolId = await createTestSchool();
    const { classId, sectionId, academicSessionId } = await createTestClassSection(schoolId);
    await createStudents(schoolId, classId, sectionId, 2);
    const exam = await createTestExam(schoolId, classId, academicSessionId);

    await expect(examSeatingService.generate(schoolId, { examId: exam.id, roomIds: [] })).rejects.toThrow(
      "Select at least one room",
    );
  });

  it("refuses a room with no capacity set", async () => {
    const schoolId = await createTestSchool();
    const { classId, sectionId, academicSessionId } = await createTestClassSection(schoolId);
    await createStudents(schoolId, classId, sectionId, 2);
    const exam = await createTestExam(schoolId, classId, academicSessionId);
    const room = await createTestRoom(schoolId, { capacity: null });

    await expect(
      examSeatingService.generate(schoolId, { examId: exam.id, roomIds: [room.id] }),
    ).rejects.toThrow(/no capacity set/);
  });

  it("leaves the overflow unseated when room capacity is short of the student count", async () => {
    const schoolId = await createTestSchool();
    const { classId, sectionId, academicSessionId } = await createTestClassSection(schoolId);
    await createStudents(schoolId, classId, sectionId, 5);
    const exam = await createTestExam(schoolId, classId, academicSessionId);
    const room = await createTestRoom(schoolId, { capacity: 3 });

    const result = await examSeatingService.generate(schoolId, { examId: exam.id, roomIds: [room.id] });
    expect(result.createdCount).toBe(3);
    expect(result.unseatedStudentIds).toHaveLength(2);

    const allocations = await examSeatingService.listForRoom(schoolId, (await withTenant(schoolId, () =>
      prisma.exam.findFirstOrThrow({ where: { id: exam.id } }),
    )).examSessionId!, room.id);
    expect(allocations).toHaveLength(3);
    expect(allocations.map((a) => a.seatNumber).sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  it("fills seats across multiple rooms in the order the rooms were given", async () => {
    const schoolId = await createTestSchool();
    const { classId, sectionId, academicSessionId } = await createTestClassSection(schoolId);
    await createStudents(schoolId, classId, sectionId, 5);
    const exam = await createTestExam(schoolId, classId, academicSessionId);
    const roomA = await createTestRoom(schoolId, { capacity: 3 });
    const roomB = await createTestRoom(schoolId, { capacity: 3 });

    const result = await examSeatingService.generate(schoolId, {
      examId: exam.id,
      roomIds: [roomA.id, roomB.id],
    });
    expect(result.createdCount).toBe(5);
    expect(result.unseatedStudentIds).toHaveLength(0);

    const examSessionId = (await withTenant(schoolId, () => prisma.exam.findFirstOrThrow({ where: { id: exam.id } })))
      .examSessionId!;
    const roomAAllocations = await examSeatingService.listForRoom(schoolId, examSessionId, roomA.id);
    const roomBAllocations = await examSeatingService.listForRoom(schoolId, examSessionId, roomB.id);
    expect(roomAAllocations).toHaveLength(3);
    expect(roomBAllocations).toHaveLength(2);
    expect(roomAAllocations.map((a) => a.seatNumber)).toEqual([1, 2, 3]);
    expect(roomBAllocations.map((a) => a.seatNumber)).toEqual([1, 2]);
  });

  it("defaults to the rooms already used by this session when roomIds is omitted", async () => {
    const schoolId = await createTestSchool();
    const { classId, sectionId, academicSessionId } = await createTestClassSection(schoolId);
    await createStudents(schoolId, classId, sectionId, 2);
    const exam = await createTestExam(schoolId, classId, academicSessionId);
    const room = await createTestRoom(schoolId, { capacity: 5 });

    await examSeatingService.generate(schoolId, { examId: exam.id, roomIds: [room.id] });
    // No roomIds this time — should fall back to the room already on record.
    const result = await examSeatingService.generate(schoolId, { examId: exam.id });
    expect(result.createdCount).toBe(2);
  });
});

describe("examSeatingService.generate — cross-class interleaving", () => {
  it("round-robins students from different class+section groups so adjacent seats alternate", async () => {
    const schoolId = await createTestSchool();
    const { academicSessionId, classId: classA, sectionId: sectionA } = await createTestClassSection(schoolId);
    const { classId: classB, sectionId: sectionB } = await createTestClassSection(schoolId);
    await createStudents(schoolId, classA, sectionA, 3);
    await createStudents(schoolId, classB, sectionB, 3);

    const session = await createTestExamSession(schoolId, academicSessionId);
    await createTestExam(schoolId, classA, academicSessionId, { examSessionId: session.id });
    await createTestExam(schoolId, classB, academicSessionId, { examSessionId: session.id });
    const room = await createTestRoom(schoolId, { capacity: 6 });

    const result = await examSeatingService.generate(schoolId, {
      examSessionId: session.id,
      roomIds: [room.id],
    });
    expect(result.createdCount).toBe(6);

    const allocations = await examSeatingService.listForRoom(schoolId, session.id, room.id);
    expect(allocations).toHaveLength(6);
    // Equal-sized groups round-robin cleanly: no two seats in a row should
    // belong to the same class+section.
    for (let i = 1; i < allocations.length; i++) {
      const prevKey = `${allocations[i - 1].classId}|${allocations[i - 1].sectionId}`;
      const curKey = `${allocations[i].classId}|${allocations[i].sectionId}`;
      expect(curKey).not.toBe(prevKey);
    }
    // Both groups fully represented.
    const classCounts = new Map<string, number>();
    for (const a of allocations) classCounts.set(a.classId, (classCounts.get(a.classId) ?? 0) + 1);
    expect(classCounts.get(classA)).toBe(3);
    expect(classCounts.get(classB)).toBe(3);
  });
});

describe("examSeatingService.generate — manual allocations", () => {
  it("preserves manual seats, skips their seat numbers, and only replaces GENERATED rows on regeneration", async () => {
    const schoolId = await createTestSchool();
    const { classId, sectionId, academicSessionId } = await createTestClassSection(schoolId);
    const students = await createStudents(schoolId, classId, sectionId, 3);
    const session = await createTestExamSession(schoolId, academicSessionId);
    await createTestExam(schoolId, classId, academicSessionId, { examSessionId: session.id });
    const room = await createTestRoom(schoolId, { capacity: 3 });
    const examSessionId = session.id;

    // Manually pin the first student to seat 1 before anything is generated,
    // so there's no risk of it colliding with a GENERATED occupant first.
    await examSeatingService.assignSeat(schoolId, examSessionId, students[0].id, {
      roomId: room.id,
      seatNumber: 1,
    });

    const result = await examSeatingService.generate(schoolId, { examSessionId, roomIds: [room.id] });
    // Only the 2 non-manual students should be (re)generated.
    expect(result.createdCount).toBe(2);

    const allocations = await examSeatingService.listForRoom(schoolId, examSessionId, room.id);
    expect(allocations).toHaveLength(3);
    const manual = allocations.find((a) => a.studentId === students[0].id)!;
    expect(manual.source).toBe(ExamAssignmentSource.MANUAL);
    expect(manual.seatNumber).toBe(1);
    // Generated seats must not reuse seat 1.
    const generated = allocations.filter((a) => a.source === ExamAssignmentSource.GENERATED);
    expect(generated.map((a) => a.seatNumber).sort((a, b) => a - b)).toEqual([2, 3]);

    // Regenerating again should not duplicate or disturb the manual seat.
    const second = await examSeatingService.generate(schoolId, { examSessionId, roomIds: [room.id] });
    expect(second.createdCount).toBe(2);
    const afterSecond = await examSeatingService.listForRoom(schoolId, examSessionId, room.id);
    expect(afterSecond).toHaveLength(3);
    expect(afterSecond.find((a) => a.studentId === students[0].id)!.source).toBe(ExamAssignmentSource.MANUAL);
  });

  it("refuses to regenerate when a manually-seated room is left out of the room list", async () => {
    const schoolId = await createTestSchool();
    const { classId, sectionId, academicSessionId } = await createTestClassSection(schoolId);
    const students = await createStudents(schoolId, classId, sectionId, 2);
    const session = await createTestExamSession(schoolId, academicSessionId);
    await createTestExam(schoolId, classId, academicSessionId, { examSessionId: session.id });
    const examSessionId = session.id;
    const roomA = await createTestRoom(schoolId, { name: "Room-A-keep", capacity: 3 });
    const roomB = await createTestRoom(schoolId, { capacity: 3 });

    await examSeatingService.assignSeat(schoolId, examSessionId, students[0].id, {
      roomId: roomA.id,
      seatNumber: 1,
    });

    await expect(
      examSeatingService.generate(schoolId, { examSessionId, roomIds: [roomB.id] }),
    ).rejects.toThrow(/Room-A-keep/);
  });
});

describe("examSeatingService.assignSeat", () => {
  async function setup(capacity = 5) {
    const schoolId = await createTestSchool();
    const { classId, sectionId, academicSessionId } = await createTestClassSection(schoolId);
    const [student] = await createStudents(schoolId, classId, sectionId, 1);
    const session = await createTestExamSession(schoolId, academicSessionId);
    await createTestExam(schoolId, classId, academicSessionId, { examSessionId: session.id });
    const room = await createTestRoom(schoolId, { capacity });
    return { schoolId, student, session, room };
  }

  it("creates then upserts (reassigns) a manual seat for the same student", async () => {
    const { schoolId, student, session, room } = await setup();

    const first = await examSeatingService.assignSeat(schoolId, session.id, student.id, {
      roomId: room.id,
      seatNumber: 2,
    });
    expect(first.seatNumber).toBe(2);
    expect(first.source).toBe(ExamAssignmentSource.MANUAL);

    const second = await examSeatingService.assignSeat(schoolId, session.id, student.id, {
      roomId: room.id,
      seatNumber: 4,
    });
    expect(second.seatNumber).toBe(4);

    const all = await examSeatingService.listForSession(schoolId, session.id);
    expect(all).toHaveLength(1); // upsert, not a second row
  });

  it("rejects a seat number beyond room capacity", async () => {
    const { schoolId, student, session, room } = await setup(3);
    await expect(
      examSeatingService.assignSeat(schoolId, session.id, student.id, { roomId: room.id, seatNumber: 4 }),
    ).rejects.toThrow(/exceeds/);
  });

  it("rejects a seat already taken by a different student", async () => {
    const { schoolId, student, session, room } = await setup(3);
    const { classId, sectionId } = await createTestClassSection(schoolId);
    const [otherStudent] = await createStudents(schoolId, classId, sectionId, 1);

    await examSeatingService.assignSeat(schoolId, session.id, student.id, { roomId: room.id, seatNumber: 1 });

    await expect(
      examSeatingService.assignSeat(schoolId, session.id, otherStudent.id, { roomId: room.id, seatNumber: 1 }),
    ).rejects.toThrow(/already assigned/);
  });

  it("404s for an unknown session, student, or room", async () => {
    const { schoolId, student, session, room } = await setup();
    await expect(
      examSeatingService.assignSeat(schoolId, "bogus-session", student.id, { roomId: room.id, seatNumber: 1 }),
    ).rejects.toThrow("Exam session not found");
    await expect(
      examSeatingService.assignSeat(schoolId, session.id, "bogus-student", { roomId: room.id, seatNumber: 1 }),
    ).rejects.toThrow("Student not found");
    await expect(
      examSeatingService.assignSeat(schoolId, session.id, student.id, { roomId: "bogus-room", seatNumber: 1 }),
    ).rejects.toThrow("Room not found");
  });
});

describe("examSeatingService.assignColumnBlock", () => {
  async function setupColumnBlocked() {
    const schoolId = await createTestSchool();
    const { classId, sectionId, academicSessionId } = await createTestClassSection(schoolId);
    const session = await createTestExamSession(schoolId, academicSessionId, {
      seatingStrategy: SeatingStrategy.COLUMN_BLOCKED,
    });
    const room = await createTestRoom(schoolId, { capacity: 20 });
    const column = await createTestRoomColumn(schoolId, room.id, 1, 5);
    return { schoolId, classId, sectionId, session, room, column };
  }

  it("refuses a session that isn't COLUMN_BLOCKED", async () => {
    const schoolId = await createTestSchool();
    const { classId, academicSessionId } = await createTestClassSection(schoolId);
    const session = await createTestExamSession(schoolId, academicSessionId); // INTERLEAVED default
    const room = await createTestRoom(schoolId, { capacity: 20 });
    const column = await createTestRoomColumn(schoolId, room.id, 1, 5);

    await expect(
      examSeatingService.assignColumnBlock(schoolId, session.id, {
        roomId: room.id,
        columnId: column.id,
        seatFrom: 1,
        seatTo: 2,
        classId,
      }),
    ).rejects.toThrow(/isn't using column-blocked seating/);
  });

  it("404s when the column belongs to a different room", async () => {
    const { schoolId, classId, session, column } = await setupColumnBlocked();
    const otherRoom = await createTestRoom(schoolId, { capacity: 20 });

    await expect(
      examSeatingService.assignColumnBlock(schoolId, session.id, {
        roomId: otherRoom.id,
        columnId: column.id, // belongs to the room created in setupColumnBlocked, not otherRoom
        seatFrom: 1,
        seatTo: 2,
        classId,
      }),
    ).rejects.toThrow("Column not found for this room");
  });

  it("rejects a seat range that exceeds the column's capacity", async () => {
    const { schoolId, classId, session, room, column } = await setupColumnBlocked();
    await expect(
      examSeatingService.assignColumnBlock(schoolId, session.id, {
        roomId: room.id,
        columnId: column.id,
        seatFrom: 1,
        seatTo: 6, // column capacity is 5
        classId,
      }),
    ).rejects.toThrow(/exceeds this column's capacity/);
  });

  it("rejects when there are no active students in the class/section", async () => {
    const { schoolId, classId, session, room, column } = await setupColumnBlocked();
    await expect(
      examSeatingService.assignColumnBlock(schoolId, session.id, {
        roomId: room.id,
        columnId: column.id,
        seatFrom: 1,
        seatTo: 5,
        classId,
      }),
    ).rejects.toThrow("No active students found for this class/section");
  });

  it("rejects when more students exist than the seat range can hold", async () => {
    const { schoolId, classId, sectionId, session, room, column } = await setupColumnBlocked();
    await createStudents(schoolId, classId, sectionId, 3);

    await expect(
      examSeatingService.assignColumnBlock(schoolId, session.id, {
        roomId: room.id,
        columnId: column.id,
        seatFrom: 1,
        seatTo: 2, // only 2 seats for 3 students
        classId,
      }),
    ).rejects.toThrow(/don't fit in/);
  });

  it("packs active students into the range in admission-number order", async () => {
    const { schoolId, classId, sectionId, session, room, column } = await setupColumnBlocked();
    const students = await createStudents(schoolId, classId, sectionId, 3);
    const sorted = [...students].sort((a, b) => a.admissionNo.localeCompare(b.admissionNo));

    const result = await examSeatingService.assignColumnBlock(schoolId, session.id, {
      roomId: room.id,
      columnId: column.id,
      seatFrom: 2,
      seatTo: 4,
      classId,
      sectionId,
    });
    expect(result).toHaveLength(3);
    const bySeat = [...result].sort((a, b) => a.seatNumber - b.seatNumber);
    expect(bySeat.map((r) => r.seatNumber)).toEqual([2, 3, 4]);
    expect(bySeat.map((r) => r.studentId)).toEqual(sorted.map((s) => s.id));
    expect(bySeat.every((r) => r.source === ExamAssignmentSource.MANUAL)).toBe(true);
  });

  it("rejects when the requested seats are already occupied by other students", async () => {
    const { schoolId, classId, sectionId, session, room, column } = await setupColumnBlocked();
    const [firstBlockStudent] = await createStudents(schoolId, classId, sectionId, 1);
    await examSeatingService.assignSeat(schoolId, session.id, firstBlockStudent.id, {
      roomId: room.id,
      seatNumber: 1,
    });
    // assignSeat doesn't set columnId, so directly occupy the column seat to
    // simulate a prior block assignment landing on seat 1 of this column.
    await withTenant(schoolId, () =>
      prisma.examSeatAllocation.update({
        where: { examSessionId_studentId: { examSessionId: session.id, studentId: firstBlockStudent.id } },
        data: { columnId: column.id, seatNumber: 1 },
      }),
    );

    const otherSection = await createTestSection(schoolId, classId, "B");
    await createStudents(schoolId, classId, otherSection.id, 1);

    await expect(
      examSeatingService.assignColumnBlock(schoolId, session.id, {
        roomId: room.id,
        columnId: column.id,
        seatFrom: 1,
        seatTo: 2,
        classId,
        sectionId: otherSection.id,
      }),
    ).rejects.toThrow(/already assigned to another student/);
  });
});

describe("examSeatingService.unassignSeat", () => {
  it("removes an existing allocation and returns it", async () => {
    const schoolId = await createTestSchool();
    const { classId, sectionId, academicSessionId } = await createTestClassSection(schoolId);
    const [student] = await createStudents(schoolId, classId, sectionId, 1);
    const session = await createTestExamSession(schoolId, academicSessionId);
    const room = await createTestRoom(schoolId, { capacity: 5 });
    await examSeatingService.assignSeat(schoolId, session.id, student.id, { roomId: room.id, seatNumber: 1 });

    const removed = await examSeatingService.unassignSeat(schoolId, session.id, student.id);
    expect(removed).not.toBeNull();
    expect(await examSeatingService.listForSession(schoolId, session.id)).toHaveLength(0);
  });

  it("returns null when there is nothing to unassign", async () => {
    const schoolId = await createTestSchool();
    const { academicSessionId } = await createTestClassSection(schoolId);
    const session = await createTestExamSession(schoolId, academicSessionId);
    const result = await examSeatingService.unassignSeat(schoolId, session.id, "no-such-student");
    expect(result).toBeNull();
  });
});
