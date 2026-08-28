"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PeriodsTab } from "@/components/academics/periods-tab";
import { useAuth } from "@/lib/auth-context";

const MANAGE_ROLES = ["SCHOOL_ADMIN", "PRINCIPAL"];

export default function AcademicPeriodsPage() {
  const { user } = useAuth();
  const canManage = !!user && MANAGE_ROLES.includes(user.role);

  return (
    <div>
      <Breadcrumbs items={[{ label: "Academics" }, { label: "Periods" }]} />
      <PageHeader title="Periods" description="Daily period/slot definitions used by the timetable" />
      <PeriodsTab canManage={canManage} />
    </div>
  );
}
