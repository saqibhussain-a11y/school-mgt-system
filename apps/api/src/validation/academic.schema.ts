import { z } from "zod";

export const createAcademicSessionSchema = z.object({
  name: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

export const updateAcademicSessionSchema = createAcademicSessionSchema
  .partial()
  .extend({ isActive: z.boolean().optional() });

export const createClassSchema = z.object({
  academicSessionId: z.string().min(1),
  name: z.string().min(1),
});

export const updateClassSchema = z.object({
  name: z.string().min(1),
});

export const createSectionSchema = z.object({
  classId: z.string().min(1),
  name: z.string().min(1),
});

export const updateSectionSchema = z.object({
  name: z.string().min(1),
});

export const createSubjectSchema = z.object({
  classId: z.string().min(1),
  name: z.string().min(1),
});

export const updateSubjectSchema = z.object({
  name: z.string().min(1),
});
