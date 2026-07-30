"use client";

import { Users, UserCog, BookOpen, CalendarCheck, Megaphone } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { AnnouncementCard, type AnnouncementSummary } from "@/components/dashboard/announcement-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";
import { attendanceTone } from "@/lib/attendance-tone";
import { formatRole } from "@/lib/format";

interface StaffWidgets {
  totalStudents: number;
  totalStaff: number;
  totalClasses: number;
  todayAttendancePercent: number;
  todayAttendanceMarked: number;
}

interface StudentWidgets {
  className: string | null;
  sectionName: string | null;
  attendancePercent30d: number;
  attendanceDaysMarked30d: number;
}

interface ParentChild {
  studentId: string;
  name: string;
  className: string;
  sectionName: string;
  attendancePercent30d: number;
}

interface DashboardResponse {
  role: string;
  widgets: Partial<StaffWidgets & StudentWidgets & { children: ParentChild[] }>;
  recentAnnouncements: AnnouncementSummary[];
}

const STAFF_ROLES = [
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "PRINCIPAL",
  "TEACHER",
  "ACCOUNTANT",
  "LIBRARIAN",
  "TRANSPORT_MANAGER",
];

function RecentAnnouncements({ announcements }: { announcements: AnnouncementSummary[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Megaphone className="size-4 text-primary" />
          Recent announcements
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {announcements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No announcements yet.</p>
        ) : (
          announcements.map((a) => <AnnouncementCard key={a.id} announcement={a} />)
        )}
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, loading } = useApi<DashboardResponse>("/api/dashboard");

  const greetingName = user?.firstName ?? "";

  return (
    <div>
      <PageHeader
        title={`Welcome back${greetingName ? `, ${greetingName}` : ""}`}
        description={user ? formatRole(user.role) : undefined}
      />

      {loading || !data ? (
        <DashboardSkeleton />
      ) : (
        <div className="flex flex-col gap-6">
          {STAFF_ROLES.includes(data.role) && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total students" value={data.widgets.totalStudents ?? 0} icon={Users} tone="primary" />
              <StatCard label="Total staff" value={data.widgets.totalStaff ?? 0} icon={UserCog} tone="neutral" />
              <StatCard label="Total classes" value={data.widgets.totalClasses ?? 0} icon={BookOpen} tone="neutral" />
              <StatCard
                label="Today's attendance"
                value={`${data.widgets.todayAttendancePercent ?? 0}%`}
                hint={`${data.widgets.todayAttendanceMarked ?? 0} records marked`}
                icon={CalendarCheck}
                tone={attendanceTone(data.widgets.todayAttendancePercent ?? 0)}
              />
            </div>
          )}

          {data.role === "STUDENT" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Class"
                value={data.widgets.className ?? "—"}
                hint={data.widgets.sectionName ? `Section ${data.widgets.sectionName}` : undefined}
                icon={BookOpen}
                tone="primary"
              />
              <StatCard
                label="Attendance (last 30 days)"
                value={`${data.widgets.attendancePercent30d ?? 0}%`}
                hint={`${data.widgets.attendanceDaysMarked30d ?? 0} days marked`}
                icon={CalendarCheck}
                tone={attendanceTone(data.widgets.attendancePercent30d ?? 0)}
              />
            </div>
          )}

          {data.role === "PARENT" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your children</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {(data.widgets.children ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No children are linked to your account yet.
                  </p>
                ) : (
                  data.widgets.children!.map((child) => (
                    <div
                      key={child.studentId}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                    >
                      <div>
                        <p className="font-medium">{child.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {child.className} · Section {child.sectionName}
                        </p>
                      </div>
                      <Badge
                        style={{
                          backgroundColor: `var(--status-${attendanceTone(child.attendancePercent30d)})`,
                          color: "white",
                        }}
                      >
                        {child.attendancePercent30d}% attendance
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          <RecentAnnouncements announcements={data.recentAnnouncements} />
        </div>
      )}
    </div>
  );
}
