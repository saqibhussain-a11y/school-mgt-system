import { Badge } from "@/components/ui/badge";
import type { FeeInvoiceStatus } from "./types";

const VARIANTS = {
  UNPAID: "destructive",
  PARTIALLY_PAID: "secondary",
  PAID: "default",
} as const;

const LABELS: Record<FeeInvoiceStatus, string> = {
  UNPAID: "Unpaid",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
};

export function FeeStatusBadge({ status }: { status: FeeInvoiceStatus }) {
  return <Badge variant={VARIANTS[status]}>{LABELS[status]}</Badge>;
}
