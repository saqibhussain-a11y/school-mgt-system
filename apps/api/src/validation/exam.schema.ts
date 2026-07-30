import { z } from "zod";

export const createExamSchema = z
  .object({
    classId: z.string().min(1),
    academicSessionId: z.string().min(1),
    name: z.string().min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    subjects: z
      .array(
        z.object({
          subjectId: z.string().min(1),
          maxMarks: z.number().int().positive(),
        }),
      )
      .min(1, "An exam needs at least one subject"),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  });

export const updateExamSchema = z.object({
  name: z.string().min(1).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const saveMarksSchema = z.object({
  records: z
    .array(
      z.object({
        studentId: z.string().min(1),
        marksObtained: z.number().min(0).nullable(),
        isAbsent: z.boolean().default(false),
      }),
    )
    .min(1),
});
