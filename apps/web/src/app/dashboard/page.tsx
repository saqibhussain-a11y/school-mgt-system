"use client";

import {
  Users,
  UserCog,
  BookOpen,
  CalendarCheck,
  Megaphone,
  BookMarked,
  AlertCircle,
  Clock,
  Bus,
  Route as RouteIcon,
  UserCheck,
  GraduationCap,
  Wallet,
  ShieldAlert,
  TrendingDown,
  ChevronRight,
  ClipboardList,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { AnnouncementCard, type AnnouncementSummary } from "@/components/dashboard/announcement-card";
import { AttendanceTrendChart, PerformanceTrendChart, FeeCollectionChart } from "@/components/reports/lazy-charts";
import { AttendanceBreakdownChart, AdmissionsChart } from "@/components/dashboard/lazy-charts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";
import { useReportClasses } from "@/lib/use-report-classes";
import { attendanceTone } from "@/lib/attendance-tone";
import { formatDate, formatRelativeTime, formatRole, formatCurrency } from "@/lib/format";

type AttendanceStatus = "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE";

interface NeedsAttentionItem {
  id: string;
  type: "leave" | "fee" | "library" | "exam";
  label: string;
  subLabel: string;
  daysAgo: number;
  href: string;
}

interface AtRiskStudentPreview {
  studentId: string;
  firstName: string;
  lastName: string;
  className: string;
  sectionName: string;
  reasons: string[];
  attendancePercentage: number | null;
  latestExamPercentage: number | null;
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
  atRiskStudents: AtRiskStudentPreview[];
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

interface DashboardResponse {
  role: string;
  widgets: Partial<StaffWidgets & StudentWidgets & { children: ParentChild[] }>;
  recentAnnouncements: AnnouncementSummary[];
}

const REPORT_STAFF_ROLES = ["SCHOOL_ADMIN", "PRINCIPAL", "TEACHER", "ACCOUNTANT"];
const GENERIC_STAT_ROLES = ["SCHOOL_ADMIN", "PRINCIPAL", "TEACHER", "ACCOUNTANT", "LIBRARIAN", "TRANSPORT_MANAGER"];
const ACADEMIC_ROLES = ["SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"];
const FEE_ROLES = ["SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"];

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

const NEEDS_ATTENTION_ICON: Record<NeedsAttentionItem["type"], typeof CalendarCheck> = {
  leave: Clock,
  fee: Wallet,
  library: BookMarked,
  exam: GraduationCap,
};

function AtRiskStudentsCard({ students }: { students: AtRiskStudentPreview[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingDown className="size-4 text-status-critical" />
          At-risk students
        </CardTitle>
        <p className="text-xs text-muted-foreground">Falling attendance or exam performance</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {students.length === 0 ? (
          <p className="text-sm text-muted-foreground">No students flagged right now.</p>
        ) : (
          <>
            {students.map((s) => (
              <Link
                key={s.studentId}
                href={`/dashboard/students/${s.studentId}`}
                className="flex items-start gap-2.5 rounded-lg border border-border p-2.5 transition-colors hover:bg-muted"
              >
                <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <TrendingDown className="size-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {s.firstName} {s.lastName} — {s.className} {s.sectionName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{s.reasons[0]}</p>
                </div>
              </Link>
            ))}
            <Link href="/dashboard/reports" className="px-1 text-xs font-medium text-primary hover:underline">
              View all in Reports →
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AttendanceBreakdownCard({ breakdown }: { breakdown: Partial<Record<AttendanceStatus, number>> }) {
  const totalMarked = Object.values(breakdown).reduce((sum: number, v) => sum + (v ?? 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Today&apos;s attendance</CardTitle>
        <p className="text-xs text-muted-foreground">School-wide, today&apos;s snapshot</p>
      </CardHeader>
      <CardContent>
        {totalMarked === 0 ? (
          <p className="text-sm text-muted-foreground">No attendance marked yet today.</p>
        ) : (
          <AttendanceBreakdownChart breakdown={breakdown} />
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

const QUICK_ACTIONS = [
  { href: "/dashboard/attendance", icon: CalendarCheck, label: "Mark attendance", subLabel: "Record today's class attendance" },
  { href: "/dashboard/students", icon: Users, label: "Add a student", subLabel: "Admit a new student" },
  { href: "/dashboard/fees", icon: Wallet, label: "Generate an invoice", subLabel: "Bill a class for a fee category" },
  { href: "/dashboard/announcements", icon: Megaphone, label: "Post an announcement", subLabel: "Notify staff, students, or parents" },
  { href: "/dashboard/staff", icon: UserCog, label: "Add staff", subLabel: "Onboard a teacher or other staff member" },
];

// A real widget, not filler for the taller At-risk students column next to
// it — these are the 5 things an admin does most often, one tap away,
// costing zero new backend queries since they're just links to pages the
// sidebar already has.
function QuickActionsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="size-4 text-primary" />
          Quick actions
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex items-center gap-2.5 rounded-lg border border-border p-2.5 transition-colors hover:bg-muted"
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <action.icon className="size-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{action.label}</p>
              <p className="truncate text-xs text-muted-foreground">{action.subLabel}</p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function AdmissionsThisWeekCard({ rows }: { rows: AdmissionRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GraduationCap className="size-4 text-primary" />
          New admissions this week
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No new admissions this week.</p>
        ) : (
          <AdmissionsChart rows={rows} />
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
                {formatCurrency(p.amount)}
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
      {/* Columns, not a grid — At-risk students and Needs attention are both
          variable-length lists (often very different lengths, sometimes
          empty) and a grid row is always as tall as its tallest cell, which
          left a dead gap under the shorter card no matter how it was
          aligned inside that cell. CSS columns give each card its own
          height instead of sharing a row. */}
      <div className="columns-1 gap-4 lg:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
        <AttendanceBreakdownCard breakdown={widgets.todayAttendanceBreakdown ?? {}} />
        <NeedsAttentionCard items={widgets.needsAttention ?? []} />
        <QuickActionsCard />
        <AtRiskStudentsCard students={widgets.atRiskStudents ?? []} />
      </div>
      <div className="columns-1 gap-4 lg:columns-2 [&>*]:mb-4 [&>*]:break-inside-avoid">
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
