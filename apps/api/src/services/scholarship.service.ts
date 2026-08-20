import { prisma } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";

const scholarshipInclude = {
  student: {
    select: {
      id: true,
      admissionNo: true,
      user: { select: { firstName: true, lastName: true } },
      class: { select: { id: true, name: true } },
    },
  },
};

export function computeScholarshipDiscount(
  scholarship: { discountType: "PERCENTAGE" | "FLAT"; discountValue: number },
  amount: number,
) {
  const raw = scholarship.discountType === "PERCENTAGE" ? (amount * scholarship.discountValue) / 100 : scholarship.discountValue;
  return Math.min(Math.round(raw * 100) / 100, amount);
}

export const scholarshipService = {
  list(schoolId: string, classId?: string) {
    return prisma.scholarship.findMany({
      where: { schoolId, ...(classId ? { student: { classId } } : {}) },
      include: scholarshipInclude,
      orderBy: { createdAt: "desc" },
    });
  },

  listForStudent(schoolId: string, studentId: string) {
    return prisma.scholarship.findMany({ where: { schoolId, studentId }, include: scholarshipInclude });
  },

  // Read inside feeInvoiceService.generate() — one scholarship per
  // (student, category) is enforced by the @@unique constraint.
  findActive(schoolId: string, studentId: string, category: string) {
    return prisma.scholarship.findFirst({ where: { schoolId, studentId, category } });
  },

  async create(
    schoolId: string,
    data: { studentId: string; category: string; discountType: "PERCENTAGE" | "FLAT"; discountValue: number },
    createdByUserId: string,
  ) {
    const student = await prisma.student.findFirst({ where: { id: data.studentId, schoolId } });
    if (!student) throw new HttpError(404, "Student not found");
    const existing = await prisma.scholarship.findFirst({
      where: { schoolId, studentId: data.studentId, category: data.category },
    });
    if (existing) throw new HttpError(400, "This student already has a scholarship for this fee category — edit it instead");
    return prisma.scholarship.create({
      data: { schoolId, ...data, createdByUserId },
      include: scholarshipInclude,
    });
  },

  async update(
    schoolId: string,
    id: string,
    data: { discountType: "PERCENTAGE" | "FLAT"; discountValue: number },
  ) {
    const existing = await prisma.scholarship.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    return prisma.scholarship.update({ where: { id }, data, include: scholarshipInclude });
  },

  async remove(schoolId: string, id: string) {
    const existing = await prisma.scholarship.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    await prisma.scholarship.delete({ where: { id } });
    return existing;
  },
};
