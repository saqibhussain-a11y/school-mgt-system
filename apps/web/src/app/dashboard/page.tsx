"use client";

import {
  Users,
  UserCog,
  BookOpen,
  CalendarCheck,
  Megaphone,
  Building2,
  ArrowRight,
  BookMarked,
  AlertCircle,
  Clock,
  Bus,
  Route as RouteIcon,
  UserCheck,
  GraduationCap,
  Wallet,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { AnnouncementCard, type AnnouncementSummary } from "@/components/dashboard/announcement-card";
import { AttendanceTrendChart, PerformanceTrendChart, FeeCollectionChart } from "@/components/reports/lazy-charts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";
import { useReportClasses } from "@/lib/use-report-classes";
import { attendanceTone } from "@/lib/attendance-tone";
import { formatDate, formatRelativeTime, formatRole } from "@/lib/format";

type AttendanceStatus = "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE";

interface NeedsAttentionItem {
  id: string;
  type: "leave" | "fee" | "library";
  label: string;
  subLabel: string;
  daysAgo: number;
  href: string;
}

interface AdmissionRow {
  classId: string;
  className: string;
  count: number;
}

interface RecentFeePayment {
  id: string;
  studentName: string;
  amount: number;
  method: string;
  paymentDate: string;
}

interface StaffWidgets {
  totalStudents: number;
  totalStaff: number;
  totalClasses: number;
  todayAttendancePercent: number;
  todayAttendanceMarked: number;
  todayAttendanceBreakdown: Partial<Record<AttendanceStatus, number>>;
  needsAttention: NeedsAttentionItem[];
  admissionsThisWeek: AdmissionRow[];
  recentFeePayments: RecentFeePayment[];
  activeLoans: number;
  overdueLoans: number;
  pendingReservations: number;
  totalVehicles: number;
  totalRoutes: number;
  studentsAssigned: number;
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

interface PlatformSchoolRow {
  id: string;
  name: string;
  subdomain: string;
  subscriptionStatus: string;
  createdAt: string;
}

interface PlatformWidgets {
  totalSchools: number;
  activeCount: number;
  pastDueCount: number;
  suspendedCount: number;
  recentSchools: PlatformSchoolRow[];
}

interface DashboardResponse {
  role: string;
  widgets: Partial<StaffWidgets & StudentWidgets & PlatformWidgets & { children: ParentChild[] }>;
  recentAnnouncements: AnnouncementSummary[];
}

const REPORT_STAFF_ROLES = ["SCHOOL_ADMIN", "PRINCIPAL", "TEACHER", "ACCOUNTANT"];
const GENERIC_STAT_ROLES = ["SCHOOL_ADMIN", "PRINCIPAL", "TEACHER", "ACCOUNTANT", "LIBRARIAN", "TRANSPORT_MANAGER"];
const ACADEMIC_ROLES = ["SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"];
const FEE_ROLES = ["SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"];

const SUBSCRIPTION_TONE: Record<string, "good" | "warning" | "critical"> = {
  active: "good",
  past_due: "warning",
  suspended: "critical",
};

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

function ReportTabs({ role }: { role: string }) {
  const { classes, isTeacher } = useReportClasses();
  const canSeeAcademic = ACADEMIC_ROLES.includes(role);
  const canSeeFees = FEE_ROLES.includes(role);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Trends</CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}

function PlatformDashboard({ widgets }: { widgets: Partial<PlatformWidgets> }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total schools" value={widgets.totalSchools ?? 0} icon={Building2} tone="primary" />
        <StatCard label="Active" value={widgets.activeCount ?? 0} icon={Building2} tone="good" />
        <StatCard label="Past due" value={widgets.pastDueCount ?? 0} icon={Building2} tone="warning" />
        <StatCard label="Suspended" value={widgets.suspendedCount ?? 0} icon={Building2} tone="critical" />
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="text-base">Recently added schools</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={
              <Link href="/dashboard/platform">
                View all
                <ArrowRight className="size-3.5" />
              </Link>
            }
          />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(widgets.recentSchools ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No schools have been added yet.</p>
          ) : (
            widgets.recentSchools!.map((school) => (
              <div
                key={school.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div>
                  <p className="font-medium">{school.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {school.subdomain} · added {formatDate(school.createdAt)}
                  </p>
                </div>
                <Badge
                  style={{
                    backgroundColor: `var(--status-${SUBSCRIPTION_TONE[school.subscriptionStatus] ?? "warning"})`,
                    color: "white",
                  }}
                >
                  {school.subscriptionStatus.replace("_", " ")}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  HALF_DAY: "Half day",
  LEAVE: "Leave",
};

const ATTENDANCE_STATUS_COLORS: Record<AttendanceStatus, string> = {
  PRESENT: "var(--status-good)",
  ABSENT: "var(--status-critical)",
  HALF_DAY: "var(--status-warning)",
  LEAVE: "var(--muted-foreground)",
};

const NEEDS_ATTENTION_ICON: Record<NeedsAttentionItem["type"], typeof CalendarCheck> = {
  leave: Clock,
  fee: Wallet,
  library: BookMarked,
};

function BarRow({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const widthPercent = max > 0 ? Math.max(4, Math.round((count / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 truncate text-sm text-foreground">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${widthPercent}%`, backgroundColor: color }} />
      </div>
      <span className="w-8 shrink-0 text-right text-sm font-medium tabular-nums text-foreground">{count}</span>
    </div>
  );
}

function AttendanceBreakdownCard({ breakdown }: { breakdown: Partial<Record<AttendanceStatus, number>> }) {
  const entries = (Object.keys(ATTENDANCE_STATUS_LABELS) as AttendanceStatus[]).map((status) => ({
    status,
    count: breakdown[status] ?? 0,
  }));
  const max = Math.max(...entries.map((e) => e.count), 1);
  const totalMarked = entries.reduce((sum, e) => sum + e.count, 0);

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-base">Today&apos;s attendance</CardTitle>
        <p className="text-xs text-muted-foreground">School-wide, today&apos;s snapshot</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {totalMarked === 0 ? (
          <p className="text-sm text-muted-foreground">No attendance marked yet today.</p>
        ) : (
          entries.map((e) => (
            <BarRow
              key={e.status}
              label={ATTENDANCE_STATUS_LABELS[e.status]}
              count={e.count}
              max={max}
              color={ATTENDANCE_STATUS_COLORS[e.status]}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function NeedsAttentionCard({ items }: { items: NeedsAttentionItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="size-4 text-status-warning" />
          Needs attention
        </CardTitle>
        <p className="text-xs text-muted-foreground">Pending items across modules</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing needs attention right now.</p>
        ) : (
          items.map((item) => {
            const Icon = NEEDS_ATTENTION_ICON[item.type];
            return (
              <Link
                key={item.id}
                href={item.href}
                className="flex items-start gap-2.5 rounded-lg border border-border p-2.5 transition-colors hover:bg-muted"
              >
                <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Icon className="size-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.subLabel}</p>
                </div>
                <Badge variant="outline" className="shrink-0 text-status-warning">
                  {item.daysAgo}d
                </Badge>
              </Link>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function AdmissionsThisWeekCard({ rows }: { rows: AdmissionRow[] }) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GraduationCap className="size-4 text-primary" />
          New admissions this week
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No new admissions this week.</p>
        ) : (
          rows.map((row, i) => (
            <BarRow
              key={row.classId}
              label={row.className}
              count={row.count}
              max={max}
              color={`var(--chart-${(i % 5) + 1})`}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function RecentFeePaymentsCard({ payments }: { payments: RecentFeePayment[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="size-4 text-primary" />
          Recent fee payments
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
        ) : (
          payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{p.studentName}</p>
                <p className="text-xs text-muted-foreground">
                  {p.method.replace("_", " ")} · {formatRelativeTime(p.paymentDate)}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                {p.amount.toLocaleString()}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function AdminOverviewPanels({ widgets }: { widgets: Partial<StaffWidgets> }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AttendanceBreakdownCard breakdown={widgets.todayAttendanceBreakdown ?? {}} />
        <NeedsAttentionCard items={widgets.needsAttention ?? []} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AdmissionsThisWeekCard rows={widgets.admissionsThisWeek ?? []} />
        <RecentFeePaymentsCard payments={widgets.recentFeePayments ?? []} />
      </div>
    </>
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
      ) : data.role === "SUPER_ADMIN" ? (
        <PlatformDashboard widgets={data.widgets} />
      ) : (
        <div className="flex flex-col gap-6">
          {GENERIC_STAT_ROLES.includes(data.role) && (
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

          {(data.role === "SCHOOL_ADMIN" || data.role === "PRINCIPAL") && (
            <AdminOverviewPanels widgets={data.widgets} />
          )}

          {data.role === "LIBRARIAN" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard label="Active loans" value={data.widgets.activeLoans ?? 0} icon={BookMarked} tone="primary" />
              <StatCard
                label="Overdue loans"
                value={data.widgets.overdueLoans ?? 0}
                icon={AlertCircle}
                tone={(data.widgets.overdueLoans ?? 0) > 0 ? "critical" : "good"}
              />
              <StatCard
                label="Reservation queue"
                value={data.widgets.pendingReservations ?? 0}
                icon={Clock}
                tone="neutral"
              />
            </div>
          )}

          {data.role === "TRANSPORT_MANAGER" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard label="Vehicles" value={data.widgets.totalVehicles ?? 0} icon={Bus} tone="primary" />
              <StatCard label="Routes" value={data.widgets.totalRoutes ?? 0} icon={RouteIcon} tone="neutral" />
              <StatCard
                label="Students assigned"
                value={data.widgets.studentsAssigned ?? 0}
                icon={UserCheck}
                tone="neutral"
              />
            </div>
          )}

          {REPORT_STAFF_ROLES.includes(data.role) && <ReportTabs role={data.role} />}

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
