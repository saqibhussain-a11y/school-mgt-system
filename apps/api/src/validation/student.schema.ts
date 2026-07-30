import { z } from "zod";

export const createStudentSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  admissionNo: z.string().min(1),
  classId: z.string().min(1),
  sectionId: z.string().min(1),
  dob: z.coerce.date(),
  admissionDate: z.coerce.date().optional(),
  previousSchool: z.string().optional(),
  medicalInfo: z.string().optional(),
});

export const updateStudentSchema = z.object({
  classId: z.string().min(1).optional(),
  sectionId: z.string().min(1).optional(),
  previousSchool: z.string().nullable().optional(),
  medicalInfo: z.string().nullable().optional(),
});

export const linkGuardianSchema = z
  .object({
    guardianId: z.string().min(1).optional(),
    guardianEmail: z.string().email().optional(),
    relationshipType: z.enum(["FATHER", "MOTHER", "GRANDPARENT", "LEGAL_GUARDIAN", "OTHER"]),
    isPrimaryContact: z.boolean().optional(),
  })
  .refine((data) => Boolean(data.guardianId) !== Boolean(data.guardianEmail), {
    message: "Provide exactly one of guardianId or guardianEmail",
  });
