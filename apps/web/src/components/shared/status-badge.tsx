import { Badge } from "@/components/ui/badge";

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-status-good/10 text-status-good",
  WITHDRAWN: "bg-muted text-muted-foreground",
  DEACTIVATED: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="secondary" className={STATUS_STYLE[status] ?? ""}>
      {status}
    </Badge>
  );
}
