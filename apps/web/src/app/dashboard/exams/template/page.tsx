"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { ResultCardTemplateTab } from "@/components/exams/result-card-template-tab";

export default function ExamResultCardTemplatePage() {
  return (
    <div>
      <Breadcrumbs items={[{ label: "Exams", href: "/dashboard/exams" }, { label: "Result Card Template" }]} />
      <PageHeader title="Result Card Template" description="School-wide result card layout used for PDF exports" />
      <ResultCardTemplateTab />
    </div>
  );
}
