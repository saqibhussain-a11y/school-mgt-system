"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkAttendanceTab } from "@/components/attendance/mark-attendance-tab";
import { ClassSummaryTab } from "@/components/attendance/class-summary-tab";
import { HolidaysTab } from "@/components/attendance/holidays-tab";
import { MyAttendanceView } from "@/components/attendance/my-attendance-view";
import { useAuth } from "@/lib/auth-context";

const MARK_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"];
const HOLIDAY_MANAGE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"];

export default function AttendancePage() {
  const { user } = useAuth();
  if (!user) return null;

  const canMark = MARK_ROLES.includes(user.role);

  return (
    <div>
      <PageHeader title="Attendance" description="Mark and review attendance" />

      {canMark ? (
        <Tabs defaultValue="mark">
          <TabsList>
            <TabsTrigger value="mark">Mark &amp; view</TabsTrigger>
            <TabsTrigger value="summary">Class summary</TabsTrigger>
            <TabsTrigger value="holidays">Holidays</TabsTrigger>
          </TabsList>
          <TabsContent value="mark" className="mt-4">
            <MarkAttendanceTab />
          </TabsContent>
          <TabsContent value="summary" className="mt-4">
            <ClassSummaryTab />
          </TabsContent>
          <TabsContent value="holidays" className="mt-4">
            <HolidaysTab canManage={HOLIDAY_MANAGE_ROLES.includes(user.role)} />
          </TabsContent>
        </Tabs>
      ) : (
        <MyAttendanceView />
      )}
    </div>
  );
}
