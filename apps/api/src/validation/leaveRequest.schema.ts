import { z } from "zod";
import { LeaveStatus } from "@sms/db";

export const LEAVE_TYPES = ["sick", "casual", "other"] as const;

export const createLeaveRequestSchema = z
  .object({
    leaveType: z.enum(LEAVE_TYPES),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    reason: z.string().min(1),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  });

export const reviewLeaveRequestSchema = z.object({
  status: z.enum([LeaveStatus.APPROVED, LeaveStatus.REJECTED]),
  reviewNote: z.string().min(1).optional(),
});
