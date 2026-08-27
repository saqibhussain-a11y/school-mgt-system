import { prisma } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";

export const roomColumnService = {
  list(schoolId: string, roomId: string) {
    return prisma.roomColumn.findMany({
      where: { schoolId, roomId },
      orderBy: { columnNumber: "asc" },
    });
  },

  async create(schoolId: string, data: { roomId: string; columnNumber: number; seatCapacity: number }) {
    const room = await prisma.room.findFirst({ where: { id: data.roomId, schoolId } });
    if (!room) throw new HttpError(400, "Room not found");

    const clashing = await prisma.roomColumn.findFirst({
      where: { roomId: data.roomId, columnNumber: data.columnNumber },
    });
    if (clashing) throw new HttpError(409, `Column ${data.columnNumber} already exists in this room`);

    return prisma.roomColumn.create({ data: { schoolId, ...data } });
  },

  async update(schoolId: string, id: string, data: { columnNumber?: number; seatCapacity?: number }) {
    const existing = await prisma.roomColumn.findFirst({ where: { id, schoolId } });
    if (!existing) return null;

    if (data.columnNumber !== undefined && data.columnNumber !== existing.columnNumber) {
      const clashing = await prisma.roomColumn.findFirst({
        where: { roomId: existing.roomId, columnNumber: data.columnNumber },
      });
      if (clashing) throw new HttpError(409, `Column ${data.columnNumber} already exists in this room`);
    }

    return prisma.roomColumn.update({ where: { id }, data });
  },

  // Blocked once a seat is assigned into it — the block-assignment endpoint
  // can't recover a dangling columnId, same reasoning as examTerm.remove.
  async remove(schoolId: string, id: string) {
    const existing = await prisma.roomColumn.findFirst({
      where: { id, schoolId },
      include: { _count: { select: { seatAllocations: true } } },
    });
    if (!existing) return null;
    if (existing._count.seatAllocations > 0) {
      throw new HttpError(400, "Cannot delete a column that already has students seated in it");
    }
    await prisma.roomColumn.delete({ where: { id } });
    return existing;
  },
};
