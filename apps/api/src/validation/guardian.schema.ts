import { z } from "zod";

export const createGuardianSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export const updateGuardianSchema = z.object({
  phone: z.string().optional(),
  address: z.string().optional(),
});
