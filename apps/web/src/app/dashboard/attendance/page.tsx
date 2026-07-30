import { CalendarCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export default function AttendancePage() {
  return (
    <div>
      <PageHeader title="Attendance" description="Mark and review attendance" />
      <ComingSoon title="Attendance register" icon={CalendarCheck} />
    </div>
  );
}
