import { prisma, StaffStatus, LeaveStatus, PayslipStatus, type PrismaTransactionClient } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";
import { inAppNotificationService } from "./inAppNotification.service";
import { generatePayslipPdf } from "../lib/payslipPdf";
import { inclusiveDayCount } from "./leaveRequest.service";

type TxClient = PrismaTransactionClient;

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

const payslipInclude = {
  staff: {
    select: {
      id: true,
      userId: true,
      designation: true,
      user: { select: { firstName: true, lastName: true } },
    },
  },
  adjustments: { orderBy: { createdAt: "asc" as const } },
};

function periodBounds(period: string) {
  const [year, month] = period.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { start, end };
}

async function recomputeNetPay(tx: TxClient, payslipId: string) {
  const payslip = await tx.payslip.findUniqueOrThrow({
    where: { id: payslipId },
    include: { adjustments: true },
  });
  const adjustmentsTotal = payslip.adjustments.reduce((sum, a) => sum + a.amount, 0);
  const netPay = roundMoney(payslip.baseSalary - payslip.unpaidLeaveDeduction + adjustmentsTotal);
  if (netPay !== payslip.netPay) {
    await tx.payslip.update({ where: { id: payslipId }, data: { netPay } });
  }
  return netPay;
}

export const payrollService = {
  // Payroll's own staff listing rather than reusing staffService.list() —
  // staff.route.ts's GET / is gated to SCHOOL_ADMIN/PRINCIPAL only, but an
  // ACCOUNTANT can manage payroll (see PAYROLL_MANAGE_ROLES) and needs to
  // see/set salaries without the broader staff-management permission.
  listStaffForSalaries(schoolId: string) {
    return prisma.staff.findMany({
      where: { schoolId, status: StaffStatus.ACTIVE },
      select: {
        id: true,
        designation: true,
        baseSalary: true,
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async setSalary(schoolId: string, staffId: string, baseSalary: number) {
    const staff = await prisma.staff.findFirst({ where: { id: staffId, schoolId } });
    if (!staff) throw new HttpError(404, "Staff not found");
    return prisma.staff.update({ where: { id: staffId }, data: { baseSalary } });
  },

  list(schoolId: string, filters: { period?: string } = {}) {
    return prisma.payslip.findMany({
      where: { schoolId, ...(filters.period ? { period: filters.period } : {}) },
      include: payslipInclude,
      orderBy: [{ period: "desc" }, { createdAt: "desc" }],
    });
  },

  getById(schoolId: string, id: string) {
    return prisma.payslip.findFirst({ where: { id, schoolId }, include: payslipInclude });
  },

  listForStaff(schoolId: string, staffId: string) {
    return prisma.payslip.findMany({
      where: { schoolId, staffId },
      include: payslipInclude,
      orderBy: { period: "desc" },
    });
  },

  // Bulk-generates one payslip per ACTIVE staff member who has a baseSalary
  // set and doesn't already have one for this period — same createMany +
  // skipDuplicates shape as feeInvoiceService.generate(), for the same
  // reason: one staff member already having a payslip (a retry, a partial
  // prior run) must not abort generation for everyone else in the batch.
  async generate(schoolId: string, period: string, generatedByUserId: string) {
    const { start: periodStart, end: periodEnd } = periodBounds(period);

    const eligible = await prisma.staff.findMany({
      where: { schoolId, status: StaffStatus.ACTIVE, baseSalary: { not: null } },
      select: { id: true, userId: true, baseSalary: true },
    });
    if (!eligible.length) {
      throw new HttpError(
        400,
        "No active staff have a base salary set yet — set one on the Salaries tab first",
      );
    }

    const existing = await prisma.payslip.findMany({
      where: { schoolId, period, staffId: { in: eligible.map((s) => s.id) } },
      select: { staffId: true },
    });
    const alreadyGenerated = new Set(existing.map((e) => e.staffId));
    const toGenerate = eligible.filter((s) => !alreadyGenerated.has(s.id));
    if (!toGenerate.length) {
      throw new HttpError(400, "Every eligible staff member already has a payslip for this period");
    }

    const unpaidLeaves = await prisma.leaveRequest.findMany({
      where: {
        schoolId,
        userId: { in: toGenerate.map((s) => s.userId) },
        status: LeaveStatus.APPROVED,
        leaveType: "unpaid",
        startDate: { lte: periodEnd },
        endDate: { gte: periodStart },
      },
      select: { userId: true, startDate: true, endDate: true },
    });
    const unpaidDaysByUser = new Map<string, number>();
    for (const lr of unpaidLeaves) {
      const clippedStart = lr.startDate < periodStart ? periodStart : lr.startDate;
      const clippedEnd = lr.endDate > periodEnd ? periodEnd : lr.endDate;
      const days = inclusiveDayCount(clippedStart, clippedEnd);
      unpaidDaysByUser.set(lr.userId, (unpaidDaysByUser.get(lr.userId) ?? 0) + days);
    }

    await prisma.payslip.createMany({
      data: toGenerate.map((s) => {
        const unpaidLeaveDays = unpaidDaysByUser.get(s.userId) ?? 0;
        // Flat 30-day divisor, not the actual number of days in the given
        // month — a common simplifying convention in local payroll practice
        // (a 31-day January and a 28-day February deduct the same amount
        // per unpaid day) rather than a hidden source of monthly drift.
        const perDayRate = s.baseSalary! / 30;
        const unpaidLeaveDeduction = roundMoney(perDayRate * unpaidLeaveDays);
        return {
          schoolId,
          staffId: s.id,
          period,
          baseSalary: s.baseSalary!,
          unpaidLeaveDays,
          unpaidLeaveDeduction,
          netPay: roundMoney(s.baseSalary! - unpaidLeaveDeduction),
          generatedByUserId,
        };
      }),
      skipDuplicates: true,
    });

    const created = await prisma.payslip.findMany({
      where: { schoolId, period, staffId: { in: toGenerate.map((s) => s.id) } },
      include: payslipInclude,
    });

    await inAppNotificationService.notifyMany(
      schoolId,
      created.map((p) => p.staff.userId),
      {
        type: "payslip_generated",
        title: "Payslip available",
        body: `Your payslip for ${period} is ready`,
        link: "/dashboard/payroll",
      },
    );

    return { generated: created.length, skipped: eligible.length - toGenerate.length, payslips: created };
  },

  async addAdjustment(schoolId: string, payslipId: string, data: { label: string; amount: number }) {
    const payslip = await prisma.payslip.findFirst({ where: { id: payslipId, schoolId } });
    if (!payslip) throw new HttpError(404, "Payslip not found");
    if (payslip.status === PayslipStatus.PAID) {
      throw new HttpError(400, "Cannot adjust a payslip that has already been marked paid");
    }
    return prisma.$transaction(async (tx) => {
      await tx.payslipAdjustment.create({ data: { schoolId, payslipId, ...data } });
      await recomputeNetPay(tx, payslipId);
      return tx.payslip.findUniqueOrThrow({ where: { id: payslipId }, include: payslipInclude });
    });
  },

  async removeAdjustment(schoolId: string, payslipId: string, adjustmentId: string) {
    const payslip = await prisma.payslip.findFirst({ where: { id: payslipId, schoolId } });
    if (!payslip) throw new HttpError(404, "Payslip not found");
    if (payslip.status === PayslipStatus.PAID) {
      throw new HttpError(400, "Cannot adjust a payslip that has already been marked paid");
    }
    const adjustment = await prisma.payslipAdjustment.findFirst({ where: { id: adjustmentId, payslipId } });
    if (!adjustment) throw new HttpError(404, "Adjustment not found");
    return prisma.$transaction(async (tx) => {
      await tx.payslipAdjustment.delete({ where: { id: adjustmentId } });
      await recomputeNetPay(tx, payslipId);
      return tx.payslip.findUniqueOrThrow({ where: { id: payslipId }, include: payslipInclude });
    });
  },

  async setStatus(schoolId: string, payslipId: string, status: "PAID" | "UNPAID") {
    const payslip = await prisma.payslip.findFirst({ where: { id: payslipId, schoolId } });
    if (!payslip) throw new HttpError(404, "Payslip not found");
    const updated = await prisma.payslip.update({
      where: { id: payslipId },
      data: { status, paidAt: status === "PAID" ? new Date() : null },
      include: payslipInclude,
    });
    if (status === "PAID") {
      await inAppNotificationService.notify(schoolId, updated.staff.userId, {
        type: "payslip_paid",
        title: "Payslip paid",
        body: `Your payslip for ${updated.period} has been marked as paid`,
        link: "/dashboard/payroll",
      });
    }
    return updated;
  },

  async getPdfBuffer(schoolId: string, id: string) {
    const [school, payslip] = await Promise.all([
      prisma.school.findUniqueOrThrow({ where: { id: schoolId } }),
      prisma.payslip.findFirst({ where: { id, schoolId }, include: payslipInclude }),
    ]);
    if (!payslip) throw new HttpError(404, "Payslip not found");
    return generatePayslipPdf(school.name, {
      staff: {
        fullName: `${payslip.staff.user.firstName} ${payslip.staff.user.lastName}`,
        designation: payslip.staff.designation,
      },
      period: payslip.period,
      baseSalary: payslip.baseSalary,
      unpaidLeaveDays: payslip.unpaidLeaveDays,
      unpaidLeaveDeduction: payslip.unpaidLeaveDeduction,
      adjustments: payslip.adjustments.map((a) => ({ label: a.label, amount: a.amount })),
      netPay: payslip.netPay,
      status: payslip.status,
      paidAt: payslip.paidAt,
    });
  },
};
