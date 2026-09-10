"use client";

import { PageHeader } from "@/components/layout/page-header";
import { RosterTab } from "@/components/staff-attendance/roster-tab";
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
            ? "Check-in/out roster with photo and GPS verification"
            : "Check in and out with a selfie and your location"
        }
      />

      {isAdmin ? <RosterTab /> : <MyCheckInView />}
    </div>
  );
}
