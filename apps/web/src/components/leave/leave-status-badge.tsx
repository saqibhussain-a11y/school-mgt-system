import { Badge } from "@/components/ui/badge";

const VARIANTS = {
  PENDING: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
  CANCELLED: "outline",
} as const;

export function LeaveStatusBadge({ status }: { status: keyof typeof VARIANTS }) {
  return (
    <Badge variant={VARIANTS[status]}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </Badge>
  );
}
