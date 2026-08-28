"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { ClassesTab } from "@/components/academics/classes-tab";
import { useAuth } from "@/lib/auth-context";

const MANAGE_ROLES = ["SCHOOL_ADMIN", "PRINCIPAL"];

export default function AcademicClassesPage() {
  const { user } = useAuth();
  const canManage = !!user && MANAGE_ROLES.includes(user.role);

  return (
    <div>
      <Breadcrumbs items={[{ label: "Academics" }, { label: "Classes" }]} />
      <PageHeader title="Classes" description="Grade levels offered by the school" />
      <ClassesTab canManage={canManage} />
    </div>
  );
}
