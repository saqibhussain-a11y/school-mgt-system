import { Badge } from "@/components/ui/badge";
import type { PayslipStatus } from "./types";

const VARIANTS = {
  UNPAID: "destructive",
  PAID: "default",
} as const;

const LABELS: Record<PayslipStatus, string> = {
  UNPAID: "Unpaid",
  PAID: "Paid",
};

export function PayslipStatusBadge({ status }: { status: PayslipStatus }) {
  return <Badge variant={VARIANTS[status]}>{LABELS[status]}</Badge>;
}
