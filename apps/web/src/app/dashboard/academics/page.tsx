import { BookOpen } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export default function AcademicsPage() {
  return (
    <div>
      <PageHeader title="Academics" description="Sessions, classes, sections, and subjects" />
      <ComingSoon title="Academic structure" icon={BookOpen} />
    </div>
  );
}
