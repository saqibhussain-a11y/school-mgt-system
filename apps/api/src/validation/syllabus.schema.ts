import { z } from "zod";

export const createSyllabusSchema = z.object({
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  academicSessionId: z.string().min(1),
});
