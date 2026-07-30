import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "primary" | "good" | "warning" | "critical" | "neutral";

const TONE_STYLES: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  good: "bg-status-good/10 text-status-good",
  warning: "bg-status-warning/15 text-status-warning",
  critical: "bg-status-critical/10 text-status-critical",
  neutral: "bg-muted text-muted-foreground",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
  hint,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: Tone;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="text-2xl font-semibold tracking-tight">{value}</span>
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", TONE_STYLES[tone])}>
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}
