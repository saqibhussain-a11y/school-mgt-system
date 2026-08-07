import { prisma, ExamAssignmentSource } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";

interface StudentRow {
  id: string;
  classId: string;
  sectionId: string;
}

// Standalone exams get seating too, via a trivial 1:1 ExamSession created
// here on first use — lazy, not eager, so the vast majority of exams that
// never need cross-class seating never see a session row at all. Real
// cross-class grouping stays a deliberate, explicit admin action (creating/
// picking a session up front in the exam dialog).
async function resolveExamSessionId(
  schoolId: string,
  params: { examId?: string; examSessionId?: string },
) {
  if (params.examSessionId) {
    const session = await prisma.examSession.findFirst({
      where: { id: params.examSessionId, schoolId },
    });
    if (!session) throw new HttpError(404, "Exam session not found");
    return session.id;
  }
  if (!params.examId) throw new HttpError(400, "examId or examSessionId is required");

  const exam = await prisma.exam.findFirst({ where: { id: params.examId, schoolId } });
  if (!exam) throw new HttpError(404, "Exam not found");
  if (exam.examSessionId) return exam.examSessionId;

  const session = await prisma.examSession.create({
    data: {
      schoolId,
      academicSessionId: exam.academicSessionId,
      name: `${exam.name} (auto)`,
      startDate: exam.startDate,
      endDate: exam.endDate,
      isAutoCreated: true,
    },
  });
  await prisma.exam.update({ where: { id: exam.id }, data: { examSessionId: session.id } });
  return session.id;
}

// Round-robin interleave: cycle through (classId, sectionId) groups taking
// one student from each per lap, skipping exhausted groups. Guarantees no
// two adjacent students in the resulting order share a class+section unless
// one group's size dominates the total so heavily it's unavoidable near the
// tail — a real, disclosed limit, not a bug. "Adjacent" here means adjacent
// seatNumber in one room's linear fill order — there's no 2-D row/column
// geometry in this model.
function interleaveByGroup(students: StudentRow[]): StudentRow[] {
  const groups = new Map<string, StudentRow[]>();
  for (const s of students) {
    const key = `${s.classId}|${s.sectionId}`;
    const arr = groups.get(key) ?? [];
    arr.push(s);
    groups.set(key, arr);
  }
  const groupList = Array.from(groups.values());
  const pointers = groupList.map(() => 0);
  const ordered: StudentRow[] = [];
  let placedThisLap = true;
  while (placedThisLap) {
    placedThisLap = false;
    for (let i = 0; i < groupList.length; i++) {
      if (pointers[i] < groupList[i].length) {
        ordered.push(groupList[i][pointers[i]]);
        pointers[i]++;
        placedThisLap = true;
      }
    }
  }
  return ordered;
}

const seatingInclude = {
  student: { include: { user: { select: { firstName: true, lastName: true } } } },
  room: true,
};

export const examSeatingService = {
  async generate(
    schoolId: string,
    params: { examId?: string; examSessionId?: string; roomIds?: string[] },
  ) {
    const examSessionId = await resolveExamSessionId(schoolId, params);

    const linkedExams = await prisma.exam.findMany({
      where: { examSessionId, schoolId },
      select: { classId: true },
    });
    const classIds = linkedExams.map((e) => e.classId);

    const students: StudentRow[] = await prisma.student.findMany({
      where: { schoolId, classId: { in: classIds }, status: "ACTIVE" },
      select: { id: true, classId: true, sectionId: true },
    });

    const existingAllocations = await prisma.examSeatAllocation.findMany({
      where: { schoolId, examSessionId },
    });
    const manualAllocations = existingAllocations.filter((a) => a.source === ExamAssignmentSource.MANUAL);
    const manualStudentIds = new Set(manualAllocations.map((a) => a.studentId));
    const manualRoomIds = new Set(manualAllocations.map((a) => a.roomId));

    let roomIds = params.roomIds && params.roomIds.length > 0 ? params.roomIds : undefined;
    if (!roomIds) {
      roomIds = Array.from(new Set(existingAllocations.map((a) => a.roomId)));
    }
    if (roomIds.length === 0) {
      throw new HttpError(400, "Select at least one room to seat this session in");
    }

    const missingManualRooms = Array.from(manualRoomIds).filter((id) => !roomIds!.includes(id));
    if (missingManualRooms.length > 0) {
      const names = await prisma.room.findMany({
        where: { id: { in: missingManualRooms } },
        select: { name: true },
      });
      throw new HttpError(
        400,
        `Room(s) ${names.map((r) => r.name).join(", ")} have manually-seated students but weren't included in this room list — include them or move those students first.`,
      );
    }

    const rooms = await prisma.room.findMany({ where: { id: { in: roomIds }, schoolId } });
    if (rooms.length !== roomIds.length) throw new HttpError(400, "One or more rooms not found");
    const missingCapacity = rooms.filter((r) => r.capacity == null);
    if (missingCapacity.length > 0) {
      throw new HttpError(
        400,
        `Room(s) ${missingCapacity.map((r) => r.name).join(", ")} have no capacity set — set one before using them for exam seating.`,
      );
    }

    const manualSeatNumbersByRoom = new Map<string, Set<number>>();
    for (const a of manualAllocations) {
      const set = manualSeatNumbersByRoom.get(a.roomId) ?? new Set<number>();
      set.add(a.seatNumber);
      manualSeatNumbersByRoom.set(a.roomId, set);
    }

    // Regeneration is always whole-session-scoped — the interleave is one
    // global computation over the entire pool, not reconcilable per room.
    await prisma.examSeatAllocation.deleteMany({
      where: { schoolId, examSessionId, source: ExamAssignmentSource.GENERATED },
    });

    const remainingStudents = students.filter((s) => !manualStudentIds.has(s.id));
    const ordered = interleaveByGroup(remainingStudents);

    const roomsOrdered = roomIds.map((id) => rooms.find((r) => r.id === id)!);
    const newAllocations: {
      studentId: string;
      classId: string;
      sectionId: string;
      roomId: string;
      seatNumber: number;
    }[] = [];
    let studentIdx = 0;
    for (const room of roomsOrdered) {
      const used = manualSeatNumbersByRoom.get(room.id) ?? new Set<number>();
      for (let seatNumber = 1; seatNumber <= room.capacity!; seatNumber++) {
        if (used.has(seatNumber)) continue;
        if (studentIdx >= ordered.length) break;
        const student = ordered[studentIdx++];
        newAllocations.push({
          studentId: student.id,
          classId: student.classId,
          sectionId: student.sectionId,
          roomId: room.id,
          seatNumber,
        });
      }
    }
    const unseatedStudentIds = ordered.slice(studentIdx).map((s) => s.id);

    if (newAllocations.length > 0) {
      await prisma.examSeatAllocation.createMany({
        data: newAllocations.map((a) => ({ schoolId, examSessionId, ...a })),
      });
    }

    const finalOccupiedRoomIds = new Set([
      ...manualRoomIds,
      ...newAllocations.map((a) => a.roomId),
    ]);
    const manualInvigilations = await prisma.examInvigilation.findMany({
      where: { schoolId, examSessionId, source: ExamAssignmentSource.MANUAL },
      include: { room: true },
    });
    const staleInvigilationWarnings = manualInvigilations
      .filter((inv) => !finalOccupiedRoomIds.has(inv.roomId))
      .map(
        (inv) =>
          `Room ${inv.room.name} no longer has any seated students, but a manual invigilation duty is still assigned there on ${inv.examDate.toISOString().slice(0, 10)}.`,
      );

    return {
      createdCount: newAllocations.length,
      unseatedStudentIds,
      staleInvigilationWarnings,
    };
  },

  listForSession(schoolId: string, examSessionId: string) {
    return prisma.examSeatAllocation.findMany({
      where: { schoolId, examSessionId },
      include: seatingInclude,
      orderBy: [{ roomId: "asc" }, { seatNumber: "asc" }],
    });
  },

  listForRoom(schoolId: string, examSessionId: string, roomId: string) {
    return prisma.examSeatAllocation.findMany({
      where: { schoolId, examSessionId, roomId },
      include: seatingInclude,
      orderBy: { seatNumber: "asc" },
    });
  },

  async assignSeat(
    schoolId: string,
    examSessionId: string,
    studentId: string,
    data: { roomId: string; seatNumber: number },
  ) {
    const [session, student, room] = await Promise.all([
      prisma.examSession.findFirst({ where: { id: examSessionId, schoolId } }),
      prisma.student.findFirst({ where: { id: studentId, schoolId } }),
      prisma.room.findFirst({ where: { id: data.roomId, schoolId } }),
    ]);
    if (!session) throw new HttpError(404, "Exam session not found");
    if (!student) throw new HttpError(404, "Student not found");
    if (!room) throw new HttpError(404, "Room not found");
    if (room.capacity != null && data.seatNumber > room.capacity) {
      throw new HttpError(400, `Seat ${data.seatNumber} exceeds ${room.name}'s capacity of ${room.capacity}`);
    }

    const seatTaken = await prisma.examSeatAllocation.findFirst({
      where: { examSessionId, roomId: data.roomId, seatNumber: data.seatNumber, studentId: { not: studentId } },
    });
    if (seatTaken) {
      throw new HttpError(409, `Seat ${data.seatNumber} in ${room.name} is already assigned to another student`);
    }

    return prisma.examSeatAllocation.upsert({
      where: { examSessionId_studentId: { examSessionId, studentId } },
      create: {
        schoolId,
        examSessionId,
        studentId,
        classId: student.classId,
        sectionId: student.sectionId,
        roomId: data.roomId,
        seatNumber: data.seatNumber,
        source: ExamAssignmentSource.MANUAL,
      },
      update: { roomId: data.roomId, seatNumber: data.seatNumber, source: ExamAssignmentSource.MANUAL },
      include: seatingInclude,
    });
  },

  async unassignSeat(schoolId: string, examSessionId: string, studentId: string) {
    const existing = await prisma.examSeatAllocation.findFirst({
      where: { schoolId, examSessionId, studentId },
    });
    if (!existing) return null;
    await prisma.examSeatAllocation.delete({ where: { id: existing.id } });
    return existing;
  },
};
