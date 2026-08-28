"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlatformApi } from "@/lib/use-platform-api";
import { formatRelativeTime } from "@/lib/format";
import type { SchoolUsage } from "./types";

export function SchoolUsageCard({ schoolId }: { schoolId: string }) {
  const { data: usage, loading } = usePlatformApi<SchoolUsage>(`/api/platform/schools/${schoolId}/usage`);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage</CardTitle>
      </CardHeader>
      <CardContent>
        {loading || !usage ? (
          <Skeleton className="h-16 rounded-md" />
        ) : (
          <div className="flex flex-wrap gap-8">
            <Stat label="Students" value={usage.studentCount} />
            <Stat label="Staff" value={usage.staffCount} />
            <Stat label="Classes" value={usage.classCount} />
            <Stat
              label="Last active"
              value={usage.lastActiveAt ? formatRelativeTime(usage.lastActiveAt) : "Never logged in"}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-xl font-semibold">{value}</span>
    </div>
  );
}
