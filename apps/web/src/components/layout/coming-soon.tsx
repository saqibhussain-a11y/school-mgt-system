import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function ComingSoon({ title, icon: Icon }: { title: string; icon: LucideIcon }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-6" />
        </div>
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">This screen is coming in a later update.</p>
        </div>
      </CardContent>
    </Card>
  );
}
