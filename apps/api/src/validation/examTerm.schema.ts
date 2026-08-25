import { z } from "zod";

export const createExamTermSchema = z.object({
  academicSessionId: z.string().min(1),
  name: z.string().min(1),
  order: z.number().int().positive(),
});

export const updateExamTermSchema = z.object({
  name: z.string().min(1).optional(),
  order: z.number().int().positive().optional(),
});
