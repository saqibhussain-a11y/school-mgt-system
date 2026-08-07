import { z } from "zod";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const generateDatesheetSchema = z.object({
  startTime: z.string().regex(TIME_RE, "Expected HH:mm"),
  endTime: z.string().regex(TIME_RE, "Expected HH:mm"),
});

export const updateExamSubjectScheduleSchema = z.object({
  examDate: z.coerce.date(),
  startTime: z.string().regex(TIME_RE, "Expected HH:mm"),
  endTime: z.string().regex(TIME_RE, "Expected HH:mm"),
});
