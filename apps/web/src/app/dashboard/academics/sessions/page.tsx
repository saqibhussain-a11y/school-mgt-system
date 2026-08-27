"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { SessionsTab } from "@/components/academics/sessions-tab";
import { useAuth } from "@/lib/auth-context";

const MANAGE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"];

export default function AcademicSessionsPage() {
  const { user } = useAuth();
  const canManage = !!user && MANAGE_ROLES.includes(user.role);

  return (
    <div>
      <Breadcrumbs items={[{ label: "Academics" }, { label: "Sessions" }]} />
      <PageHeader title="Sessions" description="Academic sessions/years" />
      <SessionsTab canManage={canManage} />
    </div>
  );
}
