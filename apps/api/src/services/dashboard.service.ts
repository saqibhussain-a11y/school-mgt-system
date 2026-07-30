import { Role, prisma } from "@sms/db";
import { announcementService, buildAnnouncementViewer } from "./announcement.service";
import { attendanceService } from "./attendance.service";
import { studentGuardianService } from "./studentGuardian.service";

const STAFF_ROLES: Role[] = [
  Role.SUPER_ADMIN,
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
    const viewer = await buildAnnouncementViewer(schoolId, user);
    const recentAnnouncements = await announcementService.list(schoolId, viewer, 5);

    if (STAFF_ROLES.includes(role)) {
      const [totalStudents, totalStaff, totalClasses, todayAttendance] = await Promise.all([
        prisma.student.count({ where: { schoolId, status: "ACTIVE" } }),
        prisma.staff.count({ where: { schoolId, status: "ACTIVE" } }),
        prisma.class.count({ where: { schoolId } }),
        attendanceService.getSchoolSummary(schoolId, startOfDay(new Date()), startOfDay(new Date())),
      ]);

      return {
        role,
        widgets: {
          totalStudents,
          totalStaff,
          totalClasses,
          todayAttendancePercent: todayAttendance.percentage,
          todayAttendanceMarked: todayAttendance.totalMarked,
        },
        recentAnnouncements,
      };
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
