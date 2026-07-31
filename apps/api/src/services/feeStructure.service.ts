import { prisma } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";

const feeStructureInclude = {
  class: { select: { id: true, name: true } },
};

export const feeStructureService = {
  list(schoolId: string, classId?: string) {
    return prisma.feeStructure.findMany({
      where: { schoolId, ...(classId ? { classId } : {}) },
      include: feeStructureInclude,
      orderBy: { createdAt: "desc" },
    });
  },

  getById(schoolId: string, id: string) {
    return prisma.feeStructure.findFirst({ where: { id, schoolId }, include: feeStructureInclude });
  },

  create(schoolId: string, data: { classId: string; category: string; amount: number }) {
    return prisma.feeStructure.create({ data: { schoolId, ...data }, include: feeStructureInclude });
  },

  async update(schoolId: string, id: string, data: { amount: number }) {
    const existing = await prisma.feeStructure.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    return prisma.feeStructure.update({ where: { id }, data, include: feeStructureInclude });
  },

  // Blocked once invoices exist against it — editing amount is fine (it's a
  // snapshot at invoice time anyway) but deleting would orphan FeeInvoice
  // rows that FK-reference it.
  async remove(schoolId: string, id: string) {
    const existing = await prisma.feeStructure.findFirst({
      where: { id, schoolId },
      include: { _count: { select: { invoices: true } } },
    });
    if (!existing) return null;
    if (existing._count.invoices > 0) {
      throw new HttpError(400, "Cannot delete a fee structure that already has invoices generated against it");
    }
    await prisma.feeStructure.delete({ where: { id } });
    return existing;
  },
};
