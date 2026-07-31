import { z } from "zod";
import { DOCUMENT_TYPES } from "../lib/certificates";

export const generateDocumentSchema = z.object({
  studentId: z.string().min(1),
  type: z.enum(DOCUMENT_TYPES),
  fields: z
    .object({
      purpose: z.string().optional(),
      reason: z.string().optional(),
      conduct: z.string().optional(),
      leavingDate: z.coerce.date().optional(),
    })
    .optional(),
});
