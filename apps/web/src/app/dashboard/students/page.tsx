import { Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export default function StudentsPage() {
  return (
    <div>
      <PageHeader title="Students" description="Manage student profiles and enrollment" />
      <ComingSoon title="Student directory" icon={Users} />
    </div>
  );
}
