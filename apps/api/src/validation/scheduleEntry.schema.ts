import { z } from "zod";

export const createScheduleEntrySchema = z.object({
  chapterId: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

export const updateScheduleEntrySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

// The two bulk-entry helpers from the confirmed design ("repeat this chapter
// across N weeks" / "split this chapter into N days") — both just generate
// multiple ScheduleEntry rows, not separate feature paths.
export const bulkGenerateScheduleSchema = z.object({
  chapterId: z.string().min(1),
  mode: z.enum(["REPEAT_WEEKLY", "SPLIT_DAYS"]),
  startDate: z.coerce.date(),
  count: z.number().int().min(1).max(52),
});
