"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { ExamSessionsTab } from "@/components/exam-sessions/exam-sessions-tab";
import { useAuth } from "@/lib/auth-context";

const ADMIN_ROLES = ["SCHOOL_ADMIN", "PRINCIPAL"];

export default function ExamSessionsPage() {
  const { user } = useAuth();
  const canManage = !!user && ADMIN_ROLES.includes(user.role);

  return (
    <div>
      <Breadcrumbs items={[{ label: "Exams", href: "/dashboard/exams" }, { label: "Exam Sessions" }]} />
      <PageHeader title="Exam Sessions" description="Datesheets, seating, and invigilation per session" />
      <ExamSessionsTab canManage={canManage} />
    </div>
  );
}
