import { UserCog } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export default function StaffPage() {
  return (
    <div>
      <PageHeader title="Staff" description="Manage teachers and other staff" />
      <ComingSoon title="Staff directory" icon={UserCog} />
    </div>
  );
}
