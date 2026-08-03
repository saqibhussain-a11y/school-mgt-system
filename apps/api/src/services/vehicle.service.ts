import { prisma } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";

export const vehicleService = {
  list(schoolId: string) {
    return prisma.vehicle.findMany({ where: { schoolId }, orderBy: { registrationNo: "asc" } });
  },

  getById(schoolId: string, id: string) {
    return prisma.vehicle.findFirst({ where: { id, schoolId } });
  },

  create(
    schoolId: string,
    data: { registrationNo: string; capacity: number; driverName: string; driverPhone: string },
  ) {
    return prisma.vehicle.create({ data: { schoolId, ...data } });
  },

  async update(
    schoolId: string,
    id: string,
    data: { registrationNo: string; capacity: number; driverName: string; driverPhone: string },
  ) {
    const existing = await prisma.vehicle.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    return prisma.vehicle.update({ where: { id }, data });
  },

  async remove(schoolId: string, id: string) {
    const existing = await prisma.vehicle.findFirst({
      where: { id, schoolId },
      include: { _count: { select: { routes: true } } },
    });
    if (!existing) return null;
    if (existing._count.routes > 0) {
      throw new HttpError(400, "Cannot delete a vehicle that is assigned to a route");
    }
    await prisma.vehicle.delete({ where: { id } });
    return existing;
  },
};
