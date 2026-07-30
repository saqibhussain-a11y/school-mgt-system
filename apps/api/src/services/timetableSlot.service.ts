import { prisma, DayOfWeek } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";

export interface TimetableSlotInput {
  classId: string;
  sectionId: string;
  subjectId: string;
  staffId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
}

const timetableSlotInclude = {
  class: true,
  section: true,
  subject: true,
  staff: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
};

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

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

  // Ties the timetable to who's actually assigned to teach this section —
  // same TeacherAssignment relationship attendance/student-scoping relies on.
  const assignment = await prisma.teacherAssignment.findFirst({
    where: { schoolId, staffId: input.staffId, classId: input.classId, sectionId: input.sectionId },
  });
  if (!assignment) {
    throw new HttpError(400, "This staff member isn't assigned to teach this class/section");
  }

  const sameDaySlots = await prisma.timetableSlot.findMany({
    where: {
      schoolId,
      dayOfWeek: input.dayOfWeek,
      OR: [{ sectionId: input.sectionId }, { staffId: input.staffId }],
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });

  for (const slot of sameDaySlots) {
    if (!overlaps(input.startTime, input.endTime, slot.startTime, slot.endTime)) continue;
    if (slot.sectionId === input.sectionId) {
      throw new HttpError(
        409,
        `This section already has a class from ${slot.startTime} to ${slot.endTime} on ${input.dayOfWeek}`,
      );
    }
    if (slot.staffId === input.staffId) {
      throw new HttpError(
        409,
        `This teacher is already scheduled from ${slot.startTime} to ${slot.endTime} on ${input.dayOfWeek}`,
      );
    }
  }
}

export const timetableSlotService = {
  listForSection(schoolId: string, sectionId: string) {
    return prisma.timetableSlot.findMany({
      where: { schoolId, sectionId },
      include: timetableSlotInclude,
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
  },

  listForStaff(schoolId: string, staffId: string) {
    return prisma.timetableSlot.findMany({
      where: { schoolId, staffId },
      include: timetableSlotInclude,
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
  },

  async create(schoolId: string, input: TimetableSlotInput) {
    await assertValidAndConflictFree(schoolId, input);
    return prisma.timetableSlot.create({
      data: { schoolId, ...input },
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
      startTime: data.startTime ?? existing.startTime,
      endTime: data.endTime ?? existing.endTime,
    };
    await assertValidAndConflictFree(schoolId, merged, id);

    return prisma.timetableSlot.update({
      where: { id },
      data: merged,
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
