"use client";

import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppearanceTab } from "@/components/settings/appearance-tab";
import { SchoolProfileTab } from "@/components/settings/school-profile-tab";
import { FeatureModulesTab } from "@/components/settings/feature-modules-tab";
import { LeavePolicyTab } from "@/components/leave/leave-policy-tab";
import { StaffAttendanceSettingsTab } from "@/components/staff-attendance/staff-attendance-settings-tab";
import { AdmissionNumberFormatTab } from "@/components/settings/admission-number-format-tab";
import { useAuth } from "@/lib/auth-context";

const ADMIN_ROLES = ["SCHOOL_ADMIN", "PRINCIPAL"];

export default function SettingsPage() {
  const { user } = useAuth();
  if (!user) return null;

  const isAdmin = ADMIN_ROLES.includes(user.role);

  const tabs: { value: string; label: string; content: ReactNode }[] = [
    { value: "appearance", label: "Appearance", content: <AppearanceTab /> },
  ];
  if (isAdmin) {
    tabs.push(
      { value: "profile", label: "School Profile", content: <SchoolProfileTab /> },
      { value: "modules", label: "Feature Modules", content: <FeatureModulesTab /> },
      { value: "leave", label: "Leave Policy", content: <LeavePolicyTab /> },
      { value: "staff-attendance", label: "Staff Attendance", content: <StaffAttendanceSettingsTab /> },
      { value: "admission", label: "Admission Numbers", content: <AdmissionNumberFormatTab /> },
    );
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description={
          isAdmin
            ? "Configure your school profile, appearance, and optional modules"
            : "Personalize how the app looks for you"
        }
      />

      {tabs.length > 1 ? (
        <Tabs defaultValue={tabs[0].value}>
          <TabsList>
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="mt-4">
              {tab.content}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        tabs[0].content
      )}
    </div>
  );
}
