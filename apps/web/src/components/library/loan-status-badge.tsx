import { Badge } from "@/components/ui/badge";
import type { BookLoan, BookReservationStatus } from "./types";

export function LoanStatusBadge({ loan }: { loan: BookLoan }) {
  if (loan.status === "ACTIVE" && new Date(loan.dueDate) < new Date()) {
    return <Badge variant="destructive">Overdue</Badge>;
  }
  if (loan.status === "ACTIVE") return <Badge variant="secondary">On loan</Badge>;
  if (loan.status === "LOST") return <Badge variant="destructive">Lost</Badge>;
  return <Badge variant="outline">Returned</Badge>;
}

const RESERVATION_LABELS: Record<BookReservationStatus, string> = {
  PENDING: "Waiting",
  READY: "Ready for pickup",
  FULFILLED: "Fulfilled",
  CANCELLED: "Cancelled",
};

export function ReservationStatusBadge({ status }: { status: BookReservationStatus }) {
  if (status === "READY") return <Badge>{RESERVATION_LABELS[status]}</Badge>;
  if (status === "PENDING") return <Badge variant="secondary">{RESERVATION_LABELS[status]}</Badge>;
  return <Badge variant="outline">{RESERVATION_LABELS[status]}</Badge>;
}
