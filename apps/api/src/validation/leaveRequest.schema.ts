import { z } from "zod";
import { LeaveStatus } from "@sms/db";

// "unpaid" has no LeavePolicy entitlement/quota (see ENTITLEMENT_LEAVE_TYPES
// below) — it exists so a staff member can request leave beyond their paid
// quota, and payroll.service.ts's generate() deducts it from that month's
// payslip. Added for Payroll; harmless if Payroll is disabled for a school.
export const LEAVE_TYPES = ["sick", "casual", "other", "unpaid"] as const;
export const ENTITLEMENT_LEAVE_TYPES = ["sick", "casual", "other"] as const;

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
