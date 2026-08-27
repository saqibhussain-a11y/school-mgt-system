import { z } from "zod";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const timeField = z.string().regex(TIME_RE, "Expected HH:mm").nullable().optional();

export const updateStaffAttendanceSettingsSchema = z.object({
  officeLat: z.coerce.number().min(-90).max(90).nullable().optional(),
  officeLng: z.coerce.number().min(-180).max(180).nullable().optional(),
  radiusMeters: z.coerce.number().int().positive().max(50_000).optional(),
  checkInWindowStart: timeField,
  checkInWindowEnd: timeField,
  checkOutWindowStart: timeField,
  checkOutWindowEnd: timeField,
});
