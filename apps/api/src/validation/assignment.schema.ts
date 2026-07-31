import { z } from "zod";

export const createAssignmentSchema = z.object({
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.coerce.date(),
  maxMarks: z.number().int().positive().optional(),
});

export const updateAssignmentSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  dueDate: z.coerce.date().optional(),
  maxMarks: z.number().int().positive().optional(),
});

export const submitAssignmentSchema = z.object({
  textAnswer: z.string().optional(),
});

export const gradeSubmissionSchema = z.object({
  marksObtained: z.number().min(0).nullable(),
  feedback: z.string().optional(),
});
