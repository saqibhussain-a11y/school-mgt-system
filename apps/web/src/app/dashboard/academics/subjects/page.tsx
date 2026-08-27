"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { SubjectsTab } from "@/components/academics/subjects-tab";
import { useAuth } from "@/lib/auth-context";

const MANAGE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"];

export default function AcademicSubjectsPage() {
  const { user } = useAuth();
  const canManage = !!user && MANAGE_ROLES.includes(user.role);

  return (
    <div>
      <Breadcrumbs items={[{ label: "Academics" }, { label: "Subjects" }]} />
      <PageHeader title="Subjects" description="Subjects taught across classes" />
      <SubjectsTab canManage={canManage} />
    </div>
  );
}
