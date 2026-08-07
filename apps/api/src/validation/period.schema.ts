import { z } from "zod";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const createPeriodSchema = z
  .object({
    periodNumber: z.number().int().positive(),
    startTime: z.string().regex(TIME_RE, "Use HH:mm format"),
    endTime: z.string().regex(TIME_RE, "Use HH:mm format"),
    isBreak: z.boolean().default(false),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });

export const updatePeriodSchema = createPeriodSchema;
