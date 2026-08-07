import { z } from "zod";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const generateInvigilationSchema = z.object({
  invigilatorsPerRoom: z.number().int().positive().default(1),
  ignoreRegularTimetableConflicts: z.boolean().default(false),
});

export const assignInvigilationSchema = z.object({
  staffId: z.string().min(1),
  roomId: z.string().min(1),
  examDate: z.coerce.date(),
  startTime: z.string().regex(TIME_RE, "Expected HH:mm"),
  endTime: z.string().regex(TIME_RE, "Expected HH:mm"),
});
