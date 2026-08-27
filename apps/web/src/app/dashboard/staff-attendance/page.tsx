"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RosterTab } from "@/components/staff-attendance/roster-tab";
import { StaffAttendanceSettingsTab } from "@/components/staff-attendance/staff-attendance-settings-tab";
import { MyCheckInView } from "@/components/staff-attendance/my-checkin-view";
import { useAuth } from "@/lib/auth-context";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"];

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
            ? "Check-in/out roster with photo and GPS verification"
            : "Check in and out with a selfie and your location"
        }
      />

      {isAdmin ? (
        <Tabs defaultValue="roster">
          <TabsList>
            <TabsTrigger value="roster">Roster</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="roster" className="mt-4">
            <RosterTab />
          </TabsContent>
          <TabsContent value="settings" className="mt-4">
            <StaffAttendanceSettingsTab />
          </TabsContent>
        </Tabs>
      ) : (
        <MyCheckInView />
      )}
    </div>
  );
}
