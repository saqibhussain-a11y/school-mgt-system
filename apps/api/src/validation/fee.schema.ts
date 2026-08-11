import { z } from "zod";

export const FEE_CATEGORIES = ["tuition", "transport", "hostel", "exam", "other"] as const;

// Real currency, 2 decimal places — deliberately no upper ceiling, that's a
// business-policy call this schema shouldn't invent.
const moneyAmount = z
  .number()
  .positive()
  .refine((n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6, "Amount cannot have more than 2 decimal places");

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
  amountPaid: moneyAmount,
  referenceNote: z.string().optional(),
});

export const applyCreditSchema = z.object({
  amount: moneyAmount,
});

export const recordRefundSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().min(1),
});
