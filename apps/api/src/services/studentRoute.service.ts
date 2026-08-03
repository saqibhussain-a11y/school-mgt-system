import { prisma } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";

const studentRouteInclude = {
  student: {
    select: { id: true, admissionNo: true, user: { select: { firstName: true, lastName: true } } },
  },
  route: {
    select: {
      id: true,
      name: true,
      vehicle: { select: { registrationNo: true, driverName: true, driverPhone: true } },
    },
  },
};

export const studentRouteService = {
  listForRoute(schoolId: string, routeId: string) {
    return prisma.studentRoute.findMany({
      where: { schoolId, routeId },
      include: studentRouteInclude,
      orderBy: { createdAt: "asc" },
    });
  },

  getForStudent(schoolId: string, studentId: string) {
    return prisma.studentRoute.findFirst({ where: { schoolId, studentId }, include: studentRouteInclude });
  },

  // A student has at most one route (@@unique([studentId])) — assigning a
  // new one replaces any existing assignment rather than erroring, since
  // "move this student to a different route" is the common case, not an edge case.
  async assign(schoolId: string, data: { studentId: string; routeId: string; pickupStop?: string }) {
    const [student, route] = await Promise.all([
      prisma.student.findFirst({ where: { id: data.studentId, schoolId } }),
      prisma.route.findFirst({ where: { id: data.routeId, schoolId } }),
    ]);
    if (!student) throw new HttpError(404, "Student not found");
    if (!route) throw new HttpError(404, "Route not found");

    return prisma.studentRoute.upsert({
      where: { studentId: data.studentId },
      create: { schoolId, ...data },
      update: { routeId: data.routeId, pickupStop: data.pickupStop },
      include: studentRouteInclude,
    });
  },

  async unassign(schoolId: string, studentId: string) {
    const existing = await prisma.studentRoute.findFirst({ where: { schoolId, studentId } });
    if (!existing) return null;
    await prisma.studentRoute.delete({ where: { studentId } });
    return existing;
  },
};
