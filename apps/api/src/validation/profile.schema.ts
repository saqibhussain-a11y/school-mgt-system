import { z } from "zod";

export const updateProfileSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().max(30).optional(),
  address: z.string().max(255).optional(),
});
