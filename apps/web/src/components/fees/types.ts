export const FEE_CATEGORIES = ["tuition", "transport", "hostel", "exam", "other"] as const;
export type FeeCategory = (typeof FEE_CATEGORIES)[number];
export type FeeInvoiceStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID";

export interface FeeStructure {
  id: string;
  classId: string;
  class: { id: string; name: string };
  category: FeeCategory;
  amount: number;
  createdAt: string;
}

export interface FeeRefund {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
}

export interface FeePayment {
  id: string;
  amountPaid: number;
  paymentMethod: "MANUAL" | "CREDIT";
  referenceNote: string | null;
  paymentDate: string;
  refunds: FeeRefund[];
}

export interface FeeInvoice {
  id: string;
  studentId: string;
  student: {
    id: string;
    admissionNo: string;
    userId: string;
    user: { firstName: string; lastName: string };
  };
  feeStructure: { id: string; category: FeeCategory; classId: string };
  period: string;
  amount: number;
  discountAmount: number;
  netAmount: number;
  dueDate: string;
  status: FeeInvoiceStatus;
  effectivePaid: number;
  balance: number;
  payments: FeePayment[];
}

export interface FeeSummary {
  invoiceCount: number;
  totalInvoiced: number;
  totalCollected: number;
  totalOutstanding: number;
  totalUnappliedCredit: number;
  countByStatus: Record<FeeInvoiceStatus, number>;
}
