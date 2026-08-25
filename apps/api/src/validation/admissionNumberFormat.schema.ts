import { z } from "zod";

export const updateAdmissionNumberFormatSchema = z.object({
  prefix: z.string().max(20),
  nextNumber: z.coerce.number().int().min(1),
  padWidth: z.coerce.number().int().min(1).max(10),
});
