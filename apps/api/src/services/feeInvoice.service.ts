import { prisma, FeeInvoiceStatus } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";
import { studentService } from "./student.service";
import { studentGuardianService } from "./studentGuardian.service";
import { inAppNotificationService } from "./inAppNotification.service";

const invoiceInclude = {
  student: {
    select: { id: true, userId: true, admissionNo: true, user: { select: { firstName: true, lastName: true } } },
  },
  feeStructure: { select: { id: true, category: true, classId: true } },
  payments: { include: { refunds: true }, orderBy: { paymentDate: "desc" as const } },
};

// balance/effectivePaid are always derived from the payments+refunds ledger,
// never stored — status IS persisted (recomputed on every write) so list
// queries (defaulter reports) don't need to join+sum for every row.
function ledgerFor(invoice: { netAmount: number; payments: { amountPaid: number; refunds: { amount: number }[] }[] }) {
  const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amountPaid, 0);
  const totalRefunded = invoice.payments.reduce(
    (sum, p) => sum + p.refunds.reduce((s, r) => s + r.amount, 0),
    0,
  );
  const effectivePaid = totalPaid - totalRefunded;
  const balance = Math.round((invoice.netAmount - effectivePaid) * 100) / 100;
  return { effectivePaid, balance };
}

function statusFor(netAmount: number, effectivePaid: number): FeeInvoiceStatus {
  if (effectivePaid >= netAmount) return FeeInvoiceStatus.PAID;
  if (effectivePaid > 0) return FeeInvoiceStatus.PARTIALLY_PAID;
  return FeeInvoiceStatus.UNPAID;
}

async function recomputeStatus(invoiceId: string) {
  const invoice = await prisma.feeInvoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { payments: { include: { refunds: true } } },
  });
  const { effectivePaid } = ledgerFor(invoice);
  const status = statusFor(invoice.netAmount, effectivePaid);
  if (status !== invoice.status) {
    await prisma.feeInvoice.update({ where: { id: invoiceId }, data: { status } });
  }
  return status;
}

function withLedger<T extends { netAmount: number; payments: { amountPaid: number; refunds: { amount: number }[] }[] }>(
  invoice: T,
) {
  return { ...invoice, ...ledgerFor(invoice) };
}

export const feeInvoiceService = {
  async generate(
    schoolId: string,
    input: { feeStructureId: string; period: string; dueDate: Date; studentIds?: string[]; createdByUserId: string },
  ) {
    const structure = await prisma.feeStructure.findFirst({ where: { id: input.feeStructureId, schoolId } });
    if (!structure) throw new HttpError(404, "Fee structure not found");

    let students: { id: string; userId: string }[];
    if (input.studentIds?.length) {
      students = await prisma.student.findMany({
        where: { id: { in: input.studentIds }, schoolId, classId: structure.classId, status: "ACTIVE" },
        select: { id: true, userId: true },
      });
    } else {
      students = await studentService.listActiveByClass(schoolId, structure.classId);
    }
    if (!students.length) throw new HttpError(400, "No matching active students to invoice");

    const existing = await prisma.feeInvoice.findMany({
      where: { schoolId, feeStructureId: input.feeStructureId, period: input.period, studentId: { in: students.map((s) => s.id) } },
      select: { studentId: true },
    });
    const alreadyInvoiced = new Set(existing.map((e) => e.studentId));
    const toInvoice = students.filter((s) => !alreadyInvoiced.has(s.id));
    if (!toInvoice.length) {
      throw new HttpError(400, "All matching students already have an invoice for this fee structure and period");
    }

    const created = await prisma.$transaction(
      toInvoice.map((s) =>
        prisma.feeInvoice.create({
          data: {
            schoolId,
            studentId: s.id,
            feeStructureId: input.feeStructureId,
            period: input.period,
            amount: structure.amount,
            netAmount: structure.amount,
            dueDate: input.dueDate,
            createdByUserId: input.createdByUserId,
          },
        }),
      ),
    );

    const parentUserIds = await studentGuardianService.getGuardianUserIdsForStudents(
      schoolId,
      toInvoice.map((s) => s.id),
    );
    await inAppNotificationService.notifyMany(schoolId, [...toInvoice.map((s) => s.userId), ...parentUserIds], {
      type: "fee_invoice",
      title: "New fee invoice",
      body: `${structure.category} fee for ${input.period}: ${structure.amount}`,
      link: "/dashboard/fees",
    });

    return { created: created.length, skipped: students.length - toInvoice.length };
  },

  async getById(schoolId: string, id: string) {
    const invoice = await prisma.feeInvoice.findFirst({ where: { id, schoolId }, include: invoiceInclude });
    if (!invoice) return null;
    return withLedger(invoice);
  },

  async listForStudent(schoolId: string, studentId: string) {
    const invoices = await prisma.feeInvoice.findMany({
      where: { schoolId, studentId },
      include: invoiceInclude,
      orderBy: { dueDate: "desc" },
    });
    return invoices.map(withLedger);
  },

  async list(schoolId: string, filters: { classId?: string; status?: FeeInvoiceStatus; overdue?: boolean } = {}) {
    const invoices = await prisma.feeInvoice.findMany({
      where: {
        schoolId,
        ...(filters.classId ? { feeStructure: { classId: filters.classId } } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.overdue ? { dueDate: { lt: new Date() }, status: { not: FeeInvoiceStatus.PAID } } : {}),
      },
      include: invoiceInclude,
      orderBy: { dueDate: "asc" },
    });
    return invoices.map(withLedger);
  },

  async summary(schoolId: string, filters: { classId?: string; period?: string } = {}) {
    const invoices = await prisma.feeInvoice.findMany({
      where: {
        schoolId,
        ...(filters.classId ? { feeStructure: { classId: filters.classId } } : {}),
        ...(filters.period ? { period: filters.period } : {}),
      },
      include: { payments: { include: { refunds: true } } },
    });

    let totalInvoiced = 0;
    let totalCollected = 0;
    const countByStatus: Record<FeeInvoiceStatus, number> = { UNPAID: 0, PARTIALLY_PAID: 0, PAID: 0 };
    for (const invoice of invoices) {
      const { effectivePaid } = ledgerFor(invoice);
      totalInvoiced += invoice.netAmount;
      totalCollected += effectivePaid;
      countByStatus[invoice.status] += 1;
    }

    return {
      invoiceCount: invoices.length,
      totalInvoiced: Math.round(totalInvoiced * 100) / 100,
      totalCollected: Math.round(totalCollected * 100) / 100,
      totalOutstanding: Math.round((totalInvoiced - totalCollected) * 100) / 100,
      countByStatus,
    };
  },

  async updateDiscount(schoolId: string, id: string, discountAmount: number) {
    const invoice = await prisma.feeInvoice.findFirst({ where: { id, schoolId }, include: { payments: true } });
    if (!invoice) return null;
    if (invoice.payments.length > 0) {
      throw new HttpError(400, "Cannot change the discount on an invoice that already has payments recorded");
    }
    if (discountAmount > invoice.amount) {
      throw new HttpError(400, "Discount cannot exceed the invoice amount");
    }
    const netAmount = Math.round((invoice.amount - discountAmount) * 100) / 100;
    return prisma.feeInvoice.update({
      where: { id },
      data: { discountAmount, netAmount, status: statusFor(netAmount, 0) },
      include: invoiceInclude,
    });
  },

  async remove(schoolId: string, id: string) {
    const invoice = await prisma.feeInvoice.findFirst({ where: { id, schoolId }, include: { payments: true } });
    if (!invoice) return null;
    if (invoice.payments.length > 0) {
      throw new HttpError(400, "Cannot delete an invoice that already has payments recorded");
    }
    await prisma.feeInvoice.delete({ where: { id } });
    return invoice;
  },

  async recordPayment(
    schoolId: string,
    invoiceId: string,
    data: { amountPaid: number; referenceNote?: string; recordedByUserId: string },
  ) {
    const invoice = await prisma.feeInvoice.findFirst({
      where: { id: invoiceId, schoolId },
      include: { payments: { include: { refunds: true } }, student: { select: { id: true, userId: true } } },
    });
    if (!invoice) throw new HttpError(404, "Invoice not found");
    const { balance } = ledgerFor(invoice);
    if (balance <= 0) throw new HttpError(400, "This invoice is already fully paid");

    const payment = await prisma.feePayment.create({
      data: {
        schoolId,
        invoiceId,
        amountPaid: data.amountPaid,
        referenceNote: data.referenceNote,
        recordedByUserId: data.recordedByUserId,
      },
    });
    const status = await recomputeStatus(invoiceId);

    const parentUserIds = await studentGuardianService.getGuardianUserIdsForStudents(schoolId, [invoice.studentId]);
    await inAppNotificationService.notifyMany(schoolId, [invoice.student.userId, ...parentUserIds], {
      type: "fee_payment",
      title: "Fee payment recorded",
      body: `Payment of ${data.amountPaid} received${status === "PAID" ? " — invoice fully paid" : ""}`,
      link: "/dashboard/fees",
    });

    return payment;
  },

  async recordRefund(schoolId: string, paymentId: string, data: { amount: number; reason: string; recordedByUserId: string }) {
    const payment = await prisma.feePayment.findFirst({
      where: { id: paymentId, schoolId },
      include: { refunds: true, invoice: true },
    });
    if (!payment) throw new HttpError(404, "Payment not found");

    const alreadyRefunded = payment.refunds.reduce((sum, r) => sum + r.amount, 0);
    if (data.amount > payment.amountPaid - alreadyRefunded) {
      throw new HttpError(400, "Refund amount exceeds what remains refundable on this payment");
    }

    const refund = await prisma.feeRefund.create({
      data: { schoolId, paymentId, amount: data.amount, reason: data.reason, recordedByUserId: data.recordedByUserId },
    });
    await recomputeStatus(payment.invoiceId);
    return refund;
  },

  async remind(schoolId: string, invoiceId: string) {
    const invoice = await prisma.feeInvoice.findFirst({
      where: { id: invoiceId, schoolId },
      include: { payments: { include: { refunds: true } }, student: { select: { id: true, userId: true } }, feeStructure: true },
    });
    if (!invoice) throw new HttpError(404, "Invoice not found");
    const { balance } = ledgerFor(invoice);
    if (balance <= 0) throw new HttpError(400, "This invoice has no outstanding balance to remind about");

    const parentUserIds = await studentGuardianService.getGuardianUserIdsForStudents(schoolId, [invoice.studentId]);
    await inAppNotificationService.notifyMany(schoolId, [invoice.student.userId, ...parentUserIds], {
      type: "fee_reminder",
      title: "Fee payment reminder",
      body: `${invoice.feeStructure.category} fee for ${invoice.period}: ${balance} outstanding`,
      link: "/dashboard/fees",
    });
  },
};
