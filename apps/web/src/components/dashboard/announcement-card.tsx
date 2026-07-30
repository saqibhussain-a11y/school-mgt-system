import { Megaphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRole } from "@/lib/format";

export interface AnnouncementSummary {
  id: string;
  title: string;
  body: string;
  targetRole?: string | null;
  targetClass?: { name: string } | null;
  creator: { firstName: string; lastName: string };
  createdAt: string;
}

export function AnnouncementCard({ announcement }: { announcement: AnnouncementSummary }) {
  return (
    <Card>
      <CardContent className="flex gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Megaphone className="size-4" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{announcement.title}</h3>
            {announcement.targetRole && (
              <Badge variant="secondary">{formatRole(announcement.targetRole)}</Badge>
            )}
            {announcement.targetClass && (
              <Badge variant="secondary">{announcement.targetClass.name}</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{announcement.body}</p>
          <p className="text-xs text-muted-foreground">
            {announcement.creator.firstName} {announcement.creator.lastName} ·{" "}
            {new Date(announcement.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
