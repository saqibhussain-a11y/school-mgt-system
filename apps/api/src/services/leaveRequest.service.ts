import { prisma, Role, LeaveStatus, AttendanceStatus } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";
import { staffService } from "./staff.service";
import { studentService } from "./student.service";
import { inAppNotificationService } from "./inAppNotification.service";
import { LEAVE_TYPES } from "../validation/leaveRequest.schema";

// Same reviewer set as REVIEW_ROLES in leaveRequest.route.ts — duplicated
// here (not imported) since routes shouldn't be a dependency of services.
const REVIEWER_ROLES: Role[] = [Role.SCHOOL_ADMIN, Role.PRINCIPAL];

// No leave-policy admin UI yet — a fixed annual entitlement per type, same
// for every staff member, is the simplest thing that satisfies the master
// doc's "balance tracking" requirement without building a whole policy
// module. Revisit if a school needs per-role/per-staff entitlements.
const DEFAULT_ANNUAL_ENTITLEMENT: Record<(typeof LEAVE_TYPES)[number], number> = {
  sick: 10,
  casual: 8,
  other: 5,
};

const leaveRequestInclude = {
  user: { select: { id: true, firstName: true, lastName: true, role: true, email: true } },
  reviewedBy: { select: { id: true, firstName: true, lastName: true } },
};

function inclusiveDayCount(start: Date, end: Date) {
  const ms = end.getTime() - start.getTime();
  return Math.round(ms / 86_400_000) + 1;
}

// Approving a student's leave marks those days as LEAVE in attendance, so a
// teacher doesn't have to separately re-mark days already covered by an
// approved request. classId/sectionId are captured from the student's
// *current* assignment at approval time, matching how markBulk captures them.
async function syncStudentAttendance(
  schoolId: string,
  request: { userId: string; startDate: Date; endDate: Date },
  reviewerId: string,
) {
  const student = await studentService.getByUserId(schoolId, request.userId);
  if (!student) return;

  const days = inclusiveDayCount(request.startDate, request.endDate);
  const dates = Array.from(
    { length: days },
    (_, i) => new Date(request.startDate.getTime() + i * 86_400_000),
  );

  await prisma.$transaction(
    dates.map((date) =>
      prisma.attendance.upsert({
        where: { studentId_date: { studentId: student.id, date } },
        create: {
          schoolId,
          studentId: student.id,
          classId: student.classId,
          sectionId: student.sectionId,
          date,
          status: AttendanceStatus.LEAVE,
          remarks: "Approved leave",
          markedByUserId: reviewerId,
        },
        update: {
          status: AttendanceStatus.LEAVE,
          remarks: "Approved leave",
          markedByUserId: reviewerId,
        },
      }),
    ),
  );
}

export const leaveRequestService = {
  listForUser(schoolId: string, userId: string) {
    return prisma.leaveRequest.findMany({
      where: { schoolId, userId },
      include: leaveRequestInclude,
      orderBy: { createdAt: "desc" },
    });
  },

  listForSchool(schoolId: string, filters: { status?: LeaveStatus; role?: Role } = {}) {
    return prisma.leaveRequest.findMany({
      where: { schoolId, ...filters },
      include: leaveRequestInclude,
      orderBy: { createdAt: "desc" },
    });
  },

  getById(schoolId: string, id: string) {
    return prisma.leaveRequest.findFirst({
      where: { id, schoolId },
      include: leaveRequestInclude,
    });
  },

  async create(
    schoolId: string,
    userId: string,
    role: Role,
    data: { leaveType: string; startDate: Date; endDate: Date; reason: string },
  ) {
    const request = await prisma.leaveRequest.create({
      data: { schoolId, userId, role, ...data },
      include: leaveRequestInclude,
    });

    const reviewers = await prisma.user.findMany({
      where: { schoolId, role: { in: REVIEWER_ROLES } },
      select: { id: true },
    });
    await inAppNotificationService.notifyMany(schoolId, reviewers.map((r) => r.id), {
      type: "leave_request",
      title: "New leave request",
      body: `${request.user.firstName} ${request.user.lastName} requested ${data.leaveType} leave`,
      link: "/dashboard/leave",
    });

    return request;
  },

  async cancel(schoolId: string, id: string, userId: string) {
    const existing = await prisma.leaveRequest.findFirst({ where: { id, schoolId, userId } });
    if (!existing) return null;
    if (existing.status !== LeaveStatus.PENDING) {
      throw new HttpError(400, "Only pending requests can be cancelled");
    }
    return prisma.leaveRequest.update({
      where: { id },
      data: { status: LeaveStatus.CANCELLED },
      include: leaveRequestInclude,
    });
  },

  async review(
    schoolId: string,
    id: string,
    reviewerId: string,
    status: LeaveStatus,
    reviewNote?: string,
  ) {
    const existing = await prisma.leaveRequest.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    if (existing.status !== LeaveStatus.PENDING) {
      throw new HttpError(400, "Only pending requests can be reviewed");
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: { status, reviewedById: reviewerId, reviewedAt: new Date(), reviewNote },
      include: leaveRequestInclude,
    });

    if (status === LeaveStatus.APPROVED && existing.role === Role.STUDENT) {
      await syncStudentAttendance(schoolId, existing, reviewerId);
    }

    await inAppNotificationService.notify(schoolId, existing.userId, {
      type: "leave_review",
      title: status === LeaveStatus.APPROVED ? "Leave request approved" : "Leave request rejected",
      body: `Your ${existing.leaveType} leave request has been ${status.toLowerCase()}`,
      link: "/dashboard/leave",
    });

    return updated;
  },

  // Only meaningful for staff — students have no leave-balance concept in
  // the master doc (Section C vs Section E). Returns null if the user has
  // no Staff profile.
  async getStaffBalance(schoolId: string, userId: string, year: number) {
    const staff = await staffService.getByUserId(schoolId, userId);
    if (!staff) return null;

    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year, 11, 31));

    const approved = await prisma.leaveRequest.findMany({
      where: {
        schoolId,
        userId,
        status: LeaveStatus.APPROVED,
        startDate: { gte: yearStart, lte: yearEnd },
      },
      select: { leaveType: true, startDate: true, endDate: true },
    });

    const usedByType: Record<string, number> = {};
    for (const req of approved) {
      usedByType[req.leaveType] =
        (usedByType[req.leaveType] ?? 0) + inclusiveDayCount(req.startDate, req.endDate);
    }

    return LEAVE_TYPES.map((leaveType) => {
      const totalDays = DEFAULT_ANNUAL_ENTITLEMENT[leaveType];
      const usedDays = usedByType[leaveType] ?? 0;
      return { leaveType, totalDays, usedDays, remainingDays: Math.max(0, totalDays - usedDays) };
    });
  },
};
