"use client";

import { PageHeader } from "@/components/layout/page-header";
import { AnnouncementCard, type AnnouncementSummary } from "@/components/dashboard/announcement-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { useApi } from "@/lib/use-api";

export default function AnnouncementsPage() {
  const { data, loading, error } = useApi<AnnouncementSummary[]>("/api/announcements");

  return (
    <div>
      <PageHeader title="Announcements" description="School-wide, role, and class updates" />

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">{error}</CardContent>
        </Card>
      ) : !data || data.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No announcements yet.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {data.map((a) => (
            <AnnouncementCard key={a.id} announcement={a} />
          ))}
        </div>
      )}
    </div>
  );
}
