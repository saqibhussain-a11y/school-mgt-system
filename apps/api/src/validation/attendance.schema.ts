import { z } from "zod";

const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "HALF_DAY", "LEAVE"] as const;

export const markAttendanceSchema = z.object({
  classId: z.string().min(1),
  sectionId: z.string().min(1),
  date: z.coerce.date(),
  records: z
    .array(
      z.object({
        studentId: z.string().min(1),
        status: z.enum(ATTENDANCE_STATUSES),
        remarks: z.string().optional(),
      }),
    )
    .min(1),
});

export const dateRangeQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
