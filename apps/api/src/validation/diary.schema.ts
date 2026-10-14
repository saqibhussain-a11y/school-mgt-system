import { z } from "zod";

const content = z.string().trim().min(1, "Write something before posting").max(2000, "Keep diary notes under 2000 characters");

// Sent as multipart form fields (the photo rides along), so every value arrives as a string.
export const createDiaryEntrySchema = z.object({
  sectionId: z.string().min(1),
  studentId: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").transform((v) => new Date(`${v}T00:00:00Z`)),
  content,
});

export const updateDiaryEntrySchema = z.object({ content });
