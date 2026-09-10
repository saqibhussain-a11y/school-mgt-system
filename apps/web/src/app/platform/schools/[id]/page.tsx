"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SubscriptionStatusSelect } from "@/components/platform/subscription-status-select";
import { PlanSelect } from "@/components/platform/plan-select";
import { ManageSchoolAdmins } from "@/components/platform/manage-school-admins";
import { SchoolUsageCard } from "@/components/platform/school-usage-card";
import { SchoolModulesCard } from "@/components/platform/school-modules-card";
import { usePlatformApi } from "@/lib/use-platform-api";
import { formatDate } from "@/lib/format";
import type { PlatformSchool } from "@/components/platform/types";

export default function PlatformSchoolDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: schools, loading, refetch } = usePlatformApi<PlatformSchool[]>("/api/platform/schools");
  const school = schools?.find((s) => s.id === params.id);

  if (loading || !school) {
    return (
      <div>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/platform/schools" />}>
          <ArrowLeft className="size-4" />
          Back to schools
        </Button>
        <Skeleton className="mt-4 h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className="mb-2"
        nativeButton={false}
        render={<Link href="/platform/schools" />}
      >
        <ArrowLeft className="size-4" />
        Back to schools
      </Button>
      <PageHeader title={school.name} description={school.subdomain} />

      <div className="flex flex-col gap-6">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">Plan</span>
              <PlanSelect schoolId={school.id} plan={school.subscriptionPlan} onChanged={refetch} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">Status</span>
              <SubscriptionStatusSelect
                schoolId={school.id}
                status={school.subscriptionStatus}
                onChanged={refetch}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">Created</span>
              <span className="text-sm">{formatDate(school.createdAt)}</span>
            </div>
          </CardContent>
        </Card>

        <SchoolUsageCard schoolId={school.id} />

        <SchoolModulesCard
          schoolId={school.id}
          enabledModules={school.enabledModules}
          onChanged={refetch}
        />

        <ManageSchoolAdmins schoolId={school.id} />
      </div>
    </div>
  );
}
