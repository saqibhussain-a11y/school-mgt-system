export type PayslipStatus = "UNPAID" | "PAID";

export interface PayslipAdjustment {
  id: string;
  label: string;
  amount: number;
  createdAt: string;
}

export interface Payslip {
  id: string;
  period: string;
  baseSalary: number;
  unpaidLeaveDays: number;
  unpaidLeaveDeduction: number;
  netPay: number;
  status: PayslipStatus;
  paidAt: string | null;
  createdAt: string;
  staff: {
    id: string;
    designation: string;
    user: { firstName: string; lastName: string };
  };
  adjustments: PayslipAdjustment[];
}

export interface StaffForSalary {
  id: string;
  designation: string;
  baseSalary: number | null;
  user: { firstName: string; lastName: string };
}
