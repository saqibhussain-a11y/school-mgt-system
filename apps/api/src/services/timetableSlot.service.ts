import { prisma, DayOfWeek, TimetableSlotSource } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";

export interface TimetableSlotInput {
  classId: string;
  sectionId: string;
  subjectId: string;
  staffId: string;
  dayOfWeek: DayOfWeek;
  periodId: string;
  roomId: string;
}

const timetableSlotInclude = {
  class: true,
  section: true,
  subject: true,
  staff: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
  period: true,
  room: true,
};

async function assertValidAndConflictFree(
  schoolId: string,
  input: TimetableSlotInput,
  excludeId?: string,
) {
  const section = await prisma.section.findFirst({
    where: { id: input.sectionId, schoolId, classId: input.classId },
  });
  if (!section) throw new HttpError(400, "Section not found for this class");

  const subject = await prisma.subject.findFirst({
    where: { id: input.subjectId, schoolId, classId: input.classId },
  });
  if (!subject) throw new HttpError(400, "Subject not found for this class");

  // Gated on teaching *capability*, not the (unrelated) attendance-scoping
  // TeacherAssignment model — every generator-placed teacher already
  // satisfies this by construction, so this never blocks a generated slot.
  const capability = await prisma.teacherSubjectAssignment.findFirst({
    where: { schoolId, staffId: input.staffId, subjectId: input.subjectId },
  });
  if (!capability) {
    throw new HttpError(400, "This staff member isn't qualified to teach this subject");
  }

  const samePeriodSlots = await prisma.timetableSlot.findMany({
    where: {
      schoolId,
      dayOfWeek: input.dayOfWeek,
      periodId: input.periodId,
      OR: [{ sectionId: input.sectionId }, { staffId: input.staffId }, { roomId: input.roomId }],
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });

  for (const slot of samePeriodSlots) {
    if (slot.sectionId === input.sectionId) {
      throw new HttpError(409, `This section already has a class in this period on ${input.dayOfWeek}`);
    }
    if (slot.staffId === input.staffId) {
      throw new HttpError(409, `This teacher is already scheduled in this period on ${input.dayOfWeek}`);
    }
    if (slot.roomId === input.roomId) {
      throw new HttpError(409, `This room is already booked in this period on ${input.dayOfWeek}`);
    }
  }
}

export const timetableSlotService = {
  listForSection(schoolId: string, sectionId: string) {
    return prisma.timetableSlot.findMany({
      where: { schoolId, sectionId },
      include: timetableSlotInclude,
      orderBy: [{ dayOfWeek: "asc" }, { period: { periodNumber: "asc" } }],
    });
  },

  listForStaff(schoolId: string, staffId: string) {
    return prisma.timetableSlot.findMany({
      where: { schoolId, staffId },
      include: timetableSlotInclude,
      orderBy: [{ dayOfWeek: "asc" }, { period: { periodNumber: "asc" } }],
    });
  },

  listForRoom(schoolId: string, roomId: string) {
    return prisma.timetableSlot.findMany({
      where: { schoolId, roomId },
      include: timetableSlotInclude,
      orderBy: [{ dayOfWeek: "asc" }, { period: { periodNumber: "asc" } }],
    });
  },

  async create(schoolId: string, input: TimetableSlotInput) {
    await assertValidAndConflictFree(schoolId, input);
    return prisma.timetableSlot.create({
      data: { schoolId, ...input, source: TimetableSlotSource.MANUAL },
      include: timetableSlotInclude,
    });
  },

  async update(schoolId: string, id: string, data: Partial<TimetableSlotInput>) {
    const existing = await prisma.timetableSlot.findFirst({ where: { id, schoolId } });
    if (!existing) return null;

    const merged: TimetableSlotInput = {
      classId: existing.classId,
      sectionId: existing.sectionId,
      subjectId: data.subjectId ?? existing.subjectId,
      staffId: data.staffId ?? existing.staffId,
      dayOfWeek: data.dayOfWeek ?? existing.dayOfWeek,
      periodId: data.periodId ?? existing.periodId,
      roomId: data.roomId ?? existing.roomId,
    };
    await assertValidAndConflictFree(schoolId, merged, id);

    // Any hand edit means "an admin deliberately touched this" — flips away
    // from GENERATED so a future regenerate can leave it alone.
    return prisma.timetableSlot.update({
      where: { id },
      data: { ...merged, source: TimetableSlotSource.MANUAL },
      include: timetableSlotInclude,
    });
  },

  async remove(schoolId: string, id: string) {
    const existing = await prisma.timetableSlot.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    await prisma.timetableSlot.delete({ where: { id } });
    return existing;
  },
};
