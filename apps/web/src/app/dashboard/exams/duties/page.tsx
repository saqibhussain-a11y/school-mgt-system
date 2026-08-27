"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { MyInvigilationDutiesView } from "@/components/exams/my-invigilation-duties-view";

export default function ExamDutiesPage() {
  return (
    <div>
      <Breadcrumbs items={[{ label: "Exams", href: "/dashboard/exams" }, { label: "My Duties" }]} />
      <PageHeader title="My Duties" description="Your invigilation assignments" />
      <MyInvigilationDutiesView />
    </div>
  );
}
