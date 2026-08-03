import { prisma } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";

const routeInclude = {
  vehicle: { select: { id: true, registrationNo: true, capacity: true, driverName: true, driverPhone: true } },
  _count: { select: { studentRoutes: true } },
};

export const routeService = {
  list(schoolId: string) {
    return prisma.route.findMany({ where: { schoolId }, include: routeInclude, orderBy: { name: "asc" } });
  },

  getById(schoolId: string, id: string) {
    return prisma.route.findFirst({ where: { id, schoolId }, include: routeInclude });
  },

  async create(schoolId: string, data: { name: string; vehicleId: string }) {
    const vehicle = await prisma.vehicle.findFirst({ where: { id: data.vehicleId, schoolId } });
    if (!vehicle) throw new HttpError(404, "Vehicle not found");
    return prisma.route.create({ data: { schoolId, ...data }, include: routeInclude });
  },

  async update(schoolId: string, id: string, data: { name: string; vehicleId: string }) {
    const existing = await prisma.route.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    const vehicle = await prisma.vehicle.findFirst({ where: { id: data.vehicleId, schoolId } });
    if (!vehicle) throw new HttpError(404, "Vehicle not found");
    return prisma.route.update({ where: { id }, data, include: routeInclude });
  },

  async remove(schoolId: string, id: string) {
    const existing = await prisma.route.findFirst({
      where: { id, schoolId },
      include: { _count: { select: { studentRoutes: true } } },
    });
    if (!existing) return null;
    if (existing._count.studentRoutes > 0) {
      throw new HttpError(400, "Cannot delete a route that has students assigned to it");
    }
    await prisma.route.delete({ where: { id } });
    return existing;
  },
};
