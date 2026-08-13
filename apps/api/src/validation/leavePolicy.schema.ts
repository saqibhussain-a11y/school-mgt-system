import { z } from "zod";

export const updateLeavePolicySchema = z.object({
  sickDays: z.coerce.number().int().min(0).max(365).optional(),
  casualDays: z.coerce.number().int().min(0).max(365).optional(),
  otherDays: z.coerce.number().int().min(0).max(365).optional(),
});
