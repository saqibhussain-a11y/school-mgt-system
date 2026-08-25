import { z } from "zod";

export const createStudentSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  admissionNo: z.string().min(1).optional(),
  classId: z.string().min(1),
  sectionId: z.string().min(1),
  dob: z.coerce.date(),
  admissionDate: z.coerce.date().optional(),
  previousSchool: z.string().optional(),
  medicalInfo: z.string().optional(),
});

export const generateCredentialsSchema = z.object({
  mode: z.enum(["ADMIN_SET", "SELF_SERVICE"]),
});

// The intermediate shape a bulk-import row is validated against once the
// column mapping has been applied — className/sectionName (not raw IDs,
// unlike createStudentSchema) since a human-typed CSV can't be expected to
// know our internal cuids.
export const bulkImportRowSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  admissionNo: z.string().min(1).optional(),
  className: z.string().min(1),
  sectionName: z.string().min(1),
  dob: z.coerce.date(),
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
