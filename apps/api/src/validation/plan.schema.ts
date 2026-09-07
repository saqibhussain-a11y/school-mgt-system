import { z } from "zod";

export const updatePlanSchema = z
  .object({
    label: z.string().min(1).optional(),
    maxStudents: z.number().int().positive().optional(),
    maxStaff: z.number().int().positive().optional(),
    priceMonthly: z.number().int().nonnegative().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, "At least one field must be provided");
