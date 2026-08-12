import { z } from "zod";

export const reportClientErrorSchema = z.object({
  message: z.string().min(1).max(2000),
  stack: z.string().max(8000).optional(),
  digest: z.string().max(200).optional(),
  url: z.string().max(2000).optional(),
});
