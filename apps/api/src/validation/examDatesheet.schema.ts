import { z } from "zod";
import { timeToMinutes } from "../lib/examSchedule";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const timeOrderCheck = {
  message: "Start time must be before end time",
  path: ["endTime"],
};

export const generateDatesheetSchema = z
  .object({
    startTime: z.string().regex(TIME_RE, "Expected HH:mm"),
    endTime: z.string().regex(TIME_RE, "Expected HH:mm"),
  })
  .refine((data) => timeToMinutes(data.startTime) < timeToMinutes(data.endTime), timeOrderCheck);

export const updateExamSubjectScheduleSchema = z
  .object({
    examDate: z.coerce.date(),
    startTime: z.string().regex(TIME_RE, "Expected HH:mm"),
    endTime: z.string().regex(TIME_RE, "Expected HH:mm"),
  })
  .refine((data) => timeToMinutes(data.startTime) < timeToMinutes(data.endTime), timeOrderCheck);
