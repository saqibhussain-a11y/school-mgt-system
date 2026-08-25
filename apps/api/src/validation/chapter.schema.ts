import { z } from "zod";

export const createChapterSchema = z.object({
  syllabusId: z.string().min(1),
  title: z.string().min(1),
  order: z.number().int().positive(),
});

export const updateChapterSchema = z.object({
  title: z.string().min(1).optional(),
  order: z.number().int().positive().optional(),
});
