import { z } from "zod";

export const createHolidaySchema = z.object({
  date: z.coerce.date(),
  name: z.string().min(1),
});
