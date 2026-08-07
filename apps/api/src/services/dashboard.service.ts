import { Role, prisma, runAsPlatform } from "@sms/db";
import { announcementService, buildAnnouncementViewer } from "./announcement.service";
import { attendanceService } from "./attendance.service";
import { studentGuardianService } from "./studentGuardian.service";

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
