"use client";

import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePlatformApi } from "@/lib/use-platform-api";
import { usePlatformAuth } from "@/lib/platform-auth-context";
import { formatDate } from "@/lib/format";

interface PlatformSchoolRow {
  id: string;
  name: string;
  subdomain: string;
  subscriptionStatus: string;
  createdAt: string;
}

interface PlatformStats {
  totalSchools: number;
  activeCount: number;
  pastDueCount: number;
  suspendedCount: number;
  recentSchools: PlatformSchoolRow[];
}

const SUBSCRIPTION_TONE: Record<string, "good" | "warning" | "critical"> = {
  active: "good",
  past_due: "warning",
  suspended: "critical",
};

export default function PlatformDashboardPage() {
  const { admin } = usePlatformAuth();
  const { data, loading } = usePlatformApi<PlatformStats>("/api/platform/dashboard");

  return (
    <div>
      <PageHeader
        title={`Welcome back${admin?.firstName ? `, ${admin.firstName}` : ""}`}
        description="Platform overview"
      />

      {loading || !data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total schools" value={data.totalSchools} icon={Building2} tone="primary" />
            <StatCard label="Active" value={data.activeCount} icon={Building2} tone="good" />
            <StatCard label="Past due" value={data.pastDueCount} icon={Building2} tone="warning" />
            <StatCard label="Suspended" value={data.suspendedCount} icon={Building2} tone="critical" />
          </div>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-base">Recently added schools</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={
                  <Link href="/platform/schools">
                    View all
                    <ArrowRight className="size-3.5" />
                  </Link>
                }
              />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {data.recentSchools.length === 0 ? (
                <p className="text-sm text-muted-foreground">No schools have been added yet.</p>
              ) : (
                data.recentSchools.map((school) => (
                  <Link
                    key={school.id}
                    href={`/platform/schools/${school.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted"
                  >
                    <div>
                      <p className="font-medium">{school.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {school.subdomain} · added {formatDate(school.createdAt)}
                      </p>
                    </div>
                    <Badge
                      style={{
                        backgroundColor: `var(--status-${SUBSCRIPTION_TONE[school.subscriptionStatus] ?? "warning"})`,
                        color: "white",
                      }}
                    >
                      {school.subscriptionStatus.replace("_", " ")}
                    </Badge>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
