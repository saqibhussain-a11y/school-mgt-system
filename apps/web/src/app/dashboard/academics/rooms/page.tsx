"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { RoomsTab } from "@/components/academics/rooms-tab";
import { useAuth } from "@/lib/auth-context";

const MANAGE_ROLES = ["SCHOOL_ADMIN", "PRINCIPAL"];

export default function AcademicRoomsPage() {
  const { user } = useAuth();
  const canManage = !!user && MANAGE_ROLES.includes(user.role);

  return (
    <div>
      <Breadcrumbs items={[{ label: "Academics" }, { label: "Rooms" }]} />
      <PageHeader title="Rooms" description="Rooms used for classes and exam seating" />
      <RoomsTab canManage={canManage} />
    </div>
  );
}
