import { z } from "zod";

export const FEE_CATEGORIES = ["tuition", "transport", "hostel", "exam", "other"] as const;

export const createFeeStructureSchema = z.object({
  classId: z.string().min(1),
  category: z.enum(FEE_CATEGORIES),
  amount: z.number().positive(),
});

export const updateFeeStructureSchema = z.object({
  amount: z.number().positive(),
});

export const generateInvoicesSchema = z.object({
  feeStructureId: z.string().min(1),
  period: z.string().min(1),
  dueDate: z.coerce.date(),
  studentIds: z.array(z.string().min(1)).optional(),
});

export const updateInvoiceDiscountSchema = z.object({
  discountAmount: z.number().min(0),
});

export const recordPaymentSchema = z.object({
  amountPaid: z.number().positive(),
  referenceNote: z.string().optional(),
});

export const recordRefundSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().min(1),
});
