"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RosterTab } from "@/components/staff-attendance/roster-tab";
import { MonthlyReportTab } from "@/components/staff-attendance/monthly-report-tab";
import { MyCheckInView } from "@/components/staff-attendance/my-checkin-view";
import { useAuth } from "@/lib/auth-context";

const ADMIN_ROLES = ["SCHOOL_ADMIN", "PRINCIPAL"];

export default function StaffAttendancePage() {
  const { user } = useAuth();
  if (!user) return null;

  const isAdmin = ADMIN_ROLES.includes(user.role);

  return (
    <div>
      <PageHeader
        title="Staff Attendance"
        description={
          isAdmin
            ? "Daily roster, monthly totals, and your own check-in"
            : "Check in and out with a selfie and your location"
        }
      />

      {isAdmin ? (
        <Tabs defaultValue="roster">
          <TabsList>
            <TabsTrigger value="roster">Daily roster</TabsTrigger>
            <TabsTrigger value="report">Monthly report</TabsTrigger>
            <TabsTrigger value="me">My check-in</TabsTrigger>
          </TabsList>
          <TabsContent value="roster" className="mt-4">
            <RosterTab />
          </TabsContent>
          <TabsContent value="report" className="mt-4">
            <MonthlyReportTab />
          </TabsContent>
          <TabsContent value="me" className="mt-4">
            <MyCheckInView />
          </TabsContent>
        </Tabs>
      ) : (
        <MyCheckInView />
      )}
    </div>
  );
}
