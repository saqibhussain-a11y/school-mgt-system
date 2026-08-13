import { Role, LeaveStatus, prisma, runAsPlatform } from "@sms/db";
import { announcementService, buildAnnouncementViewer } from "./announcement.service";
import { attendanceService } from "./attendance.service";
import { studentGuardianService } from "./studentGuardian.service";
import { leaveRequestService } from "./leaveRequest.service";
import { feeInvoiceService } from "./feeInvoice.service";
import { bookLoanService } from "./bookLoan.service";

interface NeedsAttentionItem {
  id: string;
  type: "leave" | "fee" | "library";
  label: string;
  subLabel: string;
  daysAgo: number;
  href: string;
}

const MS_PER_DAY = 86_400_000;

function daysSince(date: Date) {
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / MS_PER_DAY));
}

// Three existing, already-authorized service calls, merged into one
// cross-module "what needs a decision" list — no new query logic, just a
// different lens on data these three modules already expose to
// SCHOOL_ADMIN/PRINCIPAL individually.
async function getNeedsAttention(schoolId: string): Promise<NeedsAttentionItem[]> {
  const [pendingLeave, overdueFees, overdueLoans] = await Promise.all([
    leaveRequestService.listForSchool(schoolId, { status: LeaveStatus.PENDING }),
    feeInvoiceService.list(schoolId, { overdue: true }),
    bookLoanService.list(schoolId, { overdue: true }),
  ]);

  const items: NeedsAttentionItem[] = [
    ...pendingLeave.map((r) => ({
      id: r.id,
      type: "leave" as const,
      label: `${r.user.firstName} ${r.user.lastName} — ${r.leaveType} leave`,
      subLabel: "Awaiting review",
      daysAgo: daysSince(r.createdAt),
      href: "/dashboard/leave",
    })),
    ...overdueFees.map((inv) => ({
      id: inv.id,
      type: "fee" as const,
      label: `${inv.student.user.firstName} ${inv.student.user.lastName} — overdue invoice`,
      subLabel: `${inv.student.class.name} ${inv.student.section.name}`,
      daysAgo: daysSince(inv.dueDate),
      href: `/dashboard/fees/${inv.id}`,
    })),
    ...overdueLoans.map((loan) => ({
      id: loan.id,
      type: "library" as const,
      label: `"${loan.book.title}" overdue`,
      subLabel: `${loan.student.user.firstName} ${loan.student.user.lastName}`,
      daysAgo: daysSince(loan.dueDate),
      href: `/dashboard/library/books/${loan.book.id}`,
    })),
  ];

  return items.sort((a, b) => b.daysAgo - a.daysAgo).slice(0, 5);
}

async function getAdmissionsThisWeek(schoolId: string) {
  const sevenDaysAgo = new Date(Date.now() - 7 * MS_PER_DAY);
  const grouped = await prisma.student.groupBy({
    by: ["classId"],
    where: { schoolId, admissionDate: { gte: sevenDaysAgo } },
    _count: { _all: true },
  });
  if (grouped.length === 0) return [];

  const classes = await prisma.class.findMany({
    where: { id: { in: grouped.map((g) => g.classId) } },
    select: { id: true, name: true },
  });
  const classNameById = new Map(classes.map((c) => [c.id, c.name]));

  return grouped
    .map((g) => ({ classId: g.classId, className: classNameById.get(g.classId) ?? "—", count: g._count._all }))
    .sort((a, b) => b.count - a.count);
}

async function getRecentFeePayments(schoolId: string) {
  const payments = await prisma.feePayment.findMany({
    where: { schoolId },
    orderBy: { paymentDate: "desc" },
    take: 5,
    include: {
      invoice: { select: { student: { select: { user: { select: { firstName: true, lastName: true } } } } } },
    },
  });

  return payments.map((p) => ({
    id: p.id,
    studentName: `${p.invoice.student.user.firstName} ${p.invoice.student.user.lastName}`,
    amount: p.amountPaid,
    method: p.paymentMethod,
    paymentDate: p.paymentDate,
  }));
}

// SUPER_ADMIN is deliberately excluded here — it gets its own platform-wide
// branch below instead of this school-scoped one (its own "school" is just
// the platform-owner's internal shell, not a real customer to report on).
const STAFF_ROLES: Role[] = [
  Role.SCHOOL_ADMIN,
  Role.PRINCIPAL,
  Role.TEACHER,
  Role.ACCOUNTANT,
  Role.LIBRARIAN,
  Role.TRANSPORT_MANAGER,
];

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return startOfDay(d);
}

export const dashboardService = {
  async getForUser(schoolId: string, user: { sub: string; role: string }) {
    const role = user.role as Role;

    // Platform-wide, not school-scoped — runs outside any tenant context.
    if (role === Role.SUPER_ADMIN) {
      return runAsPlatform(async () => {
        const [totalSchools, activeCount, pastDueCount, suspendedCount, recentSchools] = await Promise.all([
          prisma.school.count(),
          prisma.school.count({ where: { subscriptionStatus: "active" } }),
          prisma.school.count({ where: { subscriptionStatus: "past_due" } }),
          prisma.school.count({ where: { subscriptionStatus: "suspended" } }),
          prisma.school.findMany({
            orderBy: { createdAt: "desc" },
            take: 5,
            select: { id: true, name: true, subdomain: true, subscriptionStatus: true, createdAt: true },
          }),
        ]);

        return {
          role,
          widgets: { totalSchools, activeCount, pastDueCount, suspendedCount, recentSchools },
          recentAnnouncements: [],
        };
      });
    }

    const viewer = await buildAnnouncementViewer(schoolId, user);
    const recentAnnouncements = await announcementService.list(schoolId, viewer, 5);

    if (STAFF_ROLES.includes(role)) {
      const [totalStudents, totalStaff, totalClasses, todayAttendance] = await Promise.all([
        prisma.student.count({ where: { schoolId, status: "ACTIVE" } }),
        prisma.staff.count({ where: { schoolId, status: "ACTIVE" } }),
        prisma.class.count({ where: { schoolId } }),
        attendanceService.getSchoolSummary(schoolId, startOfDay(new Date()), startOfDay(new Date())),
      ]);

      const widgets: Record<string, unknown> = {
        totalStudents,
        totalStaff,
        totalClasses,
        todayAttendancePercent: todayAttendance.percentage,
        todayAttendanceMarked: todayAttendance.totalMarked,
      };

      // The denser overview (breakdown/needs-attention/weekly/recent-payments
      // panels) is deliberately scoped to just these two roles — they're the
      // only ones with a full school-wide view; every other staff role keeps
      // its existing simpler widget set below, unchanged.
      if (role === Role.SCHOOL_ADMIN || role === Role.PRINCIPAL) {
        const [needsAttention, admissionsThisWeek, recentFeePayments] = await Promise.all([
          getNeedsAttention(schoolId),
          getAdmissionsThisWeek(schoolId),
          getRecentFeePayments(schoolId),
        ]);
        Object.assign(widgets, {
          todayAttendanceBreakdown: todayAttendance.breakdown,
          needsAttention,
          admissionsThisWeek,
          recentFeePayments,
        });
      }

      if (role === Role.LIBRARIAN) {
        const [activeLoans, overdueLoans, pendingReservations] = await Promise.all([
          prisma.bookLoan.count({ where: { schoolId, status: "ACTIVE" } }),
          prisma.bookLoan.count({
            where: { schoolId, status: "ACTIVE", dueDate: { lt: startOfDay(new Date()) } },
          }),
          prisma.bookReservation.count({ where: { schoolId, status: "PENDING" } }),
        ]);
        Object.assign(widgets, { activeLoans, overdueLoans, pendingReservations });
      }

      if (role === Role.TRANSPORT_MANAGER) {
        const [totalVehicles, totalRoutes, studentsAssigned] = await Promise.all([
          prisma.vehicle.count({ where: { schoolId } }),
          prisma.route.count({ where: { schoolId } }),
          prisma.studentRoute.count({ where: { schoolId } }),
        ]);
        Object.assign(widgets, { totalVehicles, totalRoutes, studentsAssigned });
      }

      return { role, widgets, recentAnnouncements };
    }

    if (role === Role.STUDENT) {
      const student = await prisma.student.findFirst({
        where: { schoolId, userId: user.sub },
        include: { class: { select: { name: true } }, section: { select: { name: true } } },
      });
      const summary = student
        ? await attendanceService.getSummaryForStudent(schoolId, student.id, daysAgo(30), startOfDay(new Date()))
        : { totalDays: 0, percentage: 0, breakdown: {} };

      return {
        role,
        widgets: {
          studentId: student?.id ?? null,
          classId: student?.classId ?? null,
          className: student?.class.name ?? null,
          sectionName: student?.section.name ?? null,
          attendancePercent30d: summary.percentage,
          attendanceDaysMarked30d: summary.totalDays,
        },
        recentAnnouncements,
      };
    }

    if (role === Role.PARENT) {
      const children = await studentGuardianService.getChildrenForGuardianUser(schoolId, user.sub);
      const childrenWithAttendance = await Promise.all(
        children.map(async (child) => {
          const summary = await attendanceService.getSummaryForStudent(
            schoolId,
            child.id,
            daysAgo(30),
            startOfDay(new Date()),
          );
          return {
            studentId: child.id,
            classId: child.classId,
            name: `${child.user.firstName} ${child.user.lastName}`,
            className: child.class.name,
            sectionName: child.section.name,
            attendancePercent30d: summary.percentage,
          };
        }),
      );

      return {
        role,
        widgets: { children: childrenWithAttendance },
        recentAnnouncements,
      };
    }

    return { role, widgets: {}, recentAnnouncements };
  },
};
