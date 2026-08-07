import { z } from "zod";
import { DayOfWeek } from "@sms/db";

export const createTimetableSlotSchema = z.object({
  classId: z.string().min(1),
  sectionId: z.string().min(1),
  subjectId: z.string().min(1),
  staffId: z.string().min(1),
  dayOfWeek: z.nativeEnum(DayOfWeek),
  periodId: z.string().min(1),
  roomId: z.string().min(1),
});

export const updateTimetableSlotSchema = z.object({
  subjectId: z.string().min(1).optional(),
  staffId: z.string().min(1).optional(),
  dayOfWeek: z.nativeEnum(DayOfWeek).optional(),
  periodId: z.string().min(1).optional(),
  roomId: z.string().min(1).optional(),
});
