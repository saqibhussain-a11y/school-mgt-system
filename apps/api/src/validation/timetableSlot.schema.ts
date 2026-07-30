import { z } from "zod";
import { DayOfWeek } from "@sms/db";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const createTimetableSlotSchema = z
  .object({
    classId: z.string().min(1),
    sectionId: z.string().min(1),
    subjectId: z.string().min(1),
    staffId: z.string().min(1),
    dayOfWeek: z.nativeEnum(DayOfWeek),
    startTime: z.string().regex(TIME_RE, "Use HH:mm format"),
    endTime: z.string().regex(TIME_RE, "Use HH:mm format"),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });

export const updateTimetableSlotSchema = z
  .object({
    subjectId: z.string().min(1).optional(),
    staffId: z.string().min(1).optional(),
    dayOfWeek: z.nativeEnum(DayOfWeek).optional(),
    startTime: z.string().regex(TIME_RE, "Use HH:mm format").optional(),
    endTime: z.string().regex(TIME_RE, "Use HH:mm format").optional(),
  })
  .refine((data) => !data.startTime || !data.endTime || data.endTime > data.startTime, {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });
