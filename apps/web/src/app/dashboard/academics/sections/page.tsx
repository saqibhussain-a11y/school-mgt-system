"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { SectionsTab } from "@/components/academics/sections-tab";
import { useAuth } from "@/lib/auth-context";

const MANAGE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"];

export default function AcademicSectionsPage() {
  const { user } = useAuth();
  const canManage = !!user && MANAGE_ROLES.includes(user.role);

  return (
    <div>
      <Breadcrumbs items={[{ label: "Academics" }, { label: "Sections" }]} />
      <PageHeader title="Sections" description="Sections within each class" />
      <SectionsTab canManage={canManage} />
    </div>
  );
}
