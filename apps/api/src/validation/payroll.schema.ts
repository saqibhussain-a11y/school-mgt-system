import { z } from "zod";

const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export const setSalarySchema = z.object({
  baseSalary: z.number().positive(),
});

export const generatePayslipsSchema = z.object({
  period: z.string().regex(PERIOD_REGEX, "period must be in YYYY-MM format"),
});

export const addAdjustmentSchema = z.object({
  label: z.string().min(1),
  amount: z.number().refine((v) => v !== 0, "amount must not be zero"),
});

export const updatePayslipStatusSchema = z.object({
  status: z.enum(["PAID", "UNPAID"]),
});
