import { z } from "zod";
import { SeatingStrategy } from "@sms/db";

export const createExamSessionSchema = z
  .object({
    academicSessionId: z.string().min(1),
    name: z.string().min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    seatingStrategy: z.nativeEnum(SeatingStrategy).optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  });

export const updateExamSessionSchema = z.object({
  name: z.string().min(1).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  seatingStrategy: z.nativeEnum(SeatingStrategy).optional(),
});
