"use client";

import { PageHeader } from "@/components/layout/page-header";
import { AttendanceTrendChart } from "@/components/reports/attendance-trend-chart";
import { PerformanceTrendChart } from "@/components/reports/performance-trend-chart";
import { FeeCollectionChart } from "@/components/reports/fee-collection-chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth-context";
import type { SchoolClass } from "@/components/academics/classes-tab";

const ACADEMIC_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"];
const FEE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"];

interface TeacherAssignmentRow {
  classId: string;
  class: { id: string; name: string };
}

export default function ReportsPage() {
  const { user } = useAuth();
  const canSeeAcademic = !!user && ACADEMIC_ROLES.includes(user.role);
  const canSeeFees = !!user && FEE_ROLES.includes(user.role);
  const isTeacher = user?.role === "TEACHER";

  const { data: allClasses } = useApi<SchoolClass[]>(!isTeacher ? "/api/classes" : null);
  const { data: myAssignments } = useApi<TeacherAssignmentRow[]>(isTeacher ? "/api/me/assignments" : null);
  const teacherClasses = Array.from(
    new Map((myAssignments ?? []).map((a) => [a.classId, a.class])).values(),
  );
  const classes: { id: string; name: string }[] = isTeacher ? teacherClasses : (allClasses ?? []);

  if (!user) return null;

  if (!canSeeAcademic && !canSeeFees) {
    return (
      <div>
        <PageHeader title="Reports" description="You don't have access to any reports." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Reports & Analytics" description="Attendance, performance, and fee collection trends" />
      <Tabs defaultValue={canSeeAcademic ? "attendance" : "fees"}>
        <TabsList>
          {canSeeAcademic && <TabsTrigger value="attendance">Attendance</TabsTrigger>}
          {canSeeAcademic && <TabsTrigger value="performance">Performance</TabsTrigger>}
          {canSeeFees && <TabsTrigger value="fees">Fee collection</TabsTrigger>}
        </TabsList>
        {canSeeAcademic && (
          <TabsContent value="attendance">
            <AttendanceTrendChart isTeacher={isTeacher} classes={classes} />
          </TabsContent>
        )}
        {canSeeAcademic && (
          <TabsContent value="performance">
            <PerformanceTrendChart isTeacher={isTeacher} classes={classes} />
          </TabsContent>
        )}
        {canSeeFees && (
          <TabsContent value="fees">
            <FeeCollectionChart classes={classes} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
