import { prisma, Prisma, FeeInvoiceStatus, type PrismaTransactionClient } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";
import { studentService } from "./student.service";
import { studentGuardianService } from "./studentGuardian.service";
import { inAppNotificationService } from "./inAppNotification.service";
import { computeScholarshipDiscount } from "./scholarship.service";
import { generateInvoicePdf } from "../lib/invoicePdf";
import { roundMoney, ledgerFor, statusFor, creditPoolFor } from "../lib/feeLedger";
import { getOrSet } from "../lib/cache";

// Not real pagination (the fee list page filters by class/status/overdue,
// no consumer paginates) — a backstop against an unbounded payload on a
// school whose invoice history has grown large after years of manual
// invoicing.
const LIST_SAFETY_CAP = 2000;

type TxClient = PrismaTransactionClient;

const invoiceInclude = {
  student: {
    select: {
      id: true,
      userId: true,
      admissionNo: true,
      user: { select: { firstName: true, lastName: true } },
      class: { select: { name: true } },
      section: { select: { name: true } },
    },
  },
  feeStructure: { select: { id: true, category: true, classId: true } },
  payments: { include: { refunds: true }, orderBy: { paymentDate: "desc" as const } },
};

const creditPoolInclude = {
  netAmount: true,
  payments: { select: { amountPaid: true, paymentMethod: true, refunds: { select: { amount: true } } } },
};

async function recomputeStatus(tx: TxClient, invoiceId: string) {
  const invoice = await tx.feeInvoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { payments: { include: { refunds: true } } },
  });
  const { effectivePaid } = ledgerFor(invoice);
  const status = statusFor(invoice.netAmount, effectivePaid);
  if (status !== invoice.status) {
    await tx.feeInvoice.update({ where: { id: invoiceId }, data: { status } });
  }
  return status;
}

// Forces a row lock on the student for the lifetime of the enclosing
// transaction — every money-moving operation on a given student (payment,
// refund, credit application) must serialize against every other one, since
// the credit pool is a derived SUM with no unique constraint that could
// otherwise catch a concurrent double-spend. See feeLedger.ts.
async function lockStudentRow(tx: TxClient, studentId: string) {
  await tx.student.update({ where: { id: studentId }, data: { updatedAt: new Date() } });
}

async function creditPoolForStudent(tx: TxClient, schoolId: string, studentId: string) {
  const invoices = await tx.feeInvoice.findMany({ where: { schoolId, studentId }, select: creditPoolInclude });
  return creditPoolFor(invoices);
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

    // Scholarships auto-apply here, at generation time, same
    // snapshot-at-generation philosophy as `amount` above — a scholarship
    // granted/edited later only affects invoices generated after that.
    const scholarships = await prisma.scholarship.findMany({
      where: { schoolId, category: structure.category, studentId: { in: toInvoice.map((s) => s.id) } },
    });
    const scholarshipByStudent = new Map(scholarships.map((s) => [s.studentId, s]));

    // createMany + skipDuplicates, not an array of individual creates inside
    // one all-or-nothing $transaction — that form meant a single student
    // who got invoiced by a concurrent request in the gap between the check
    // above and this write aborted creation for every OTHER, non-conflicting
    // student in the same batch too. skipDuplicates lets Postgres silently
    // no-op just the genuinely-conflicting row(s) instead of the whole batch.
    const result = await prisma.feeInvoice.createMany({
      data: toInvoice.map((s) => {
        const scholarship = scholarshipByStudent.get(s.id);
        const discountAmount = scholarship ? computeScholarshipDiscount(scholarship, structure.amount) : 0;
        return {
          schoolId,
          studentId: s.id,
          feeStructureId: input.feeStructureId,
          period: input.period,
          amount: structure.amount,
          discountAmount,
          netAmount: roundMoney(structure.amount - discountAmount),
          dueDate: input.dueDate,
          createdByUserId: input.createdByUserId,
        };
      }),
      skipDuplicates: true,
    });

    // createMany doesn't return which rows landed — re-check against
    // `toInvoice` specifically (not `students`) so a concurrent request that
    // won the race on one of these students isn't double-notified as if we
    // had invoiced them.
    const invoicedNow = await prisma.feeInvoice.findMany({
      where: {
        schoolId,
        feeStructureId: input.feeStructureId,
        period: input.period,
        studentId: { in: toInvoice.map((s) => s.id) },
      },
      select: { studentId: true },
    });
    const invoicedNowIds = new Set(invoicedNow.map((i) => i.studentId));
    const actuallyInvoiced = toInvoice.filter((s) => invoicedNowIds.has(s.id));

    const parentUserIds = await studentGuardianService.getGuardianUserIdsForStudents(
      schoolId,
      actuallyInvoiced.map((s) => s.id),
    );
    await inAppNotificationService.notifyMany(
      schoolId,
      [...actuallyInvoiced.map((s) => s.userId), ...parentUserIds],
      {
        type: "fee_invoice",
        title: "New fee invoice",
        body: `${structure.category} fee for ${input.period}: ${structure.amount}`,
        link: "/dashboard/fees",
      },
    );

    return { created: result.count, skipped: students.length - result.count };
  },

  async getById(schoolId: string, id: string) {
    const invoice = await prisma.feeInvoice.findFirst({ where: { id, schoolId }, include: invoiceInclude });
    if (!invoice) return null;
    return withLedger(invoice);
  },

  async getPdfBuffer(schoolId: string, id: string) {
    const [school, invoice] = await Promise.all([
      prisma.school.findUniqueOrThrow({ where: { id: schoolId } }),
      prisma.feeInvoice.findFirst({ where: { id, schoolId }, include: invoiceInclude }),
    ]);
    if (!invoice) throw new HttpError(404, "Invoice not found");
    const { effectivePaid, balance } = ledgerFor(invoice);

    return generateInvoicePdf(school.name, {
      invoiceNo: invoice.id.slice(-8).toUpperCase(),
      student: {
        fullName: `${invoice.student.user.firstName} ${invoice.student.user.lastName}`,
        admissionNo: invoice.student.admissionNo,
        className: invoice.student.class.name,
        sectionName: invoice.student.section.name,
      },
      category: invoice.feeStructure.category,
      period: invoice.period,
      dueDate: invoice.dueDate,
      amount: invoice.amount,
      discountAmount: invoice.discountAmount,
      netAmount: invoice.netAmount,
      effectivePaid,
      balance,
      status: invoice.status,
      payments: invoice.payments.map((p) => ({ date: p.paymentDate, amount: p.amountPaid, referenceNote: p.referenceNote })),
    });
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
      take: LIST_SAFETY_CAP,
    });
    return invoices.map(withLedger);
  },

  // Unapplied credit is computed school-wide, independent of any list/period
  // filter a caller applies — a student's overpayment doesn't stop being a
  // real liability just because a report is scoped elsewhere. It used to be
  // a full unfiltered table scan re-run on every single summary() call
  // regardless of filters; since the value itself doesn't depend on
  // filters, it's cached per-school instead of recomputed every time.
  async schoolWideUnappliedCredit(schoolId: string) {
    return getOrSet(`fee-invoice:unapplied-credit:${schoolId}`, 60, async () => {
      const allInvoices = await prisma.feeInvoice.findMany({
        where: { schoolId },
        select: { studentId: true, ...creditPoolInclude },
      });
      const byStudent = new Map<string, typeof allInvoices>();
      for (const invoice of allInvoices) {
        const list = byStudent.get(invoice.studentId) ?? [];
        list.push(invoice);
        byStudent.set(invoice.studentId, list);
      }
      let totalUnappliedCredit = 0;
      for (const studentInvoices of byStudent.values()) {
        totalUnappliedCredit += Math.max(0, creditPoolFor(studentInvoices));
      }
      return roundMoney(totalUnappliedCredit);
    });
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
    let totalOutstanding = 0;
    const countByStatus: Record<FeeInvoiceStatus, number> = { UNPAID: 0, PARTIALLY_PAID: 0, PAID: 0 };
    for (const invoice of invoices) {
      const { effectivePaid, balance } = ledgerFor(invoice);
      totalInvoiced += invoice.netAmount;
      // Capped at netAmount — unapplied credit is a deferred liability, not
      // collected revenue, and balance is already clamped at 0 so summing
      // it never lets one student's overpayment net against another's
      // arrears (both were true bugs in the unclamped version of this).
      totalCollected += Math.min(effectivePaid, invoice.netAmount);
      totalOutstanding += balance;
      countByStatus[invoice.status] += 1;
    }

    const totalUnappliedCredit = await this.schoolWideUnappliedCredit(schoolId);

    return {
      invoiceCount: invoices.length,
      totalInvoiced: roundMoney(totalInvoiced),
      totalCollected: roundMoney(totalCollected),
      totalOutstanding: roundMoney(totalOutstanding),
      totalUnappliedCredit,
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

  // No upper guard on amountPaid vs. the invoice's balance — an amount
  // beyond what's owed mints fee credit (see feeLedger.ts's creditPoolFor)
  // rather than being rejected. This also means a payment on an
  // already-fully-paid invoice (the classic "duplicate bank transfer"
  // case) is a supported action now, not an error.
  async recordPayment(
    schoolId: string,
    invoiceId: string,
    data: { amountPaid: number; referenceNote?: string; recordedByUserId: string; idempotencyKey?: string },
  ) {
    // A retried/double-clicked submission replays the same key — return the
    // payment that request already created rather than recording a second
    // one. Deliberately does NOT re-send the notification below; that fired
    // once, on whichever attempt actually created the row.
    if (data.idempotencyKey) {
      const existing = await prisma.feePayment.findFirst({ where: { schoolId, idempotencyKey: data.idempotencyKey } });
      if (existing) return existing;
    }

    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
        const invoice = await tx.feeInvoice.findFirst({
          where: { id: invoiceId, schoolId },
          include: { payments: { include: { refunds: true } }, student: { select: { id: true, userId: true } } },
        });
        if (!invoice) throw new HttpError(404, "Invoice not found");

        await lockStudentRow(tx, invoice.studentId);

        const { effectivePaid: oldEffectivePaid } = ledgerFor(invoice);
        const oldMinted = Math.max(0, roundMoney(oldEffectivePaid - invoice.netAmount));

        const payment = await tx.feePayment.create({
          data: {
            schoolId,
            invoiceId,
            amountPaid: data.amountPaid,
            referenceNote: data.referenceNote,
            recordedByUserId: data.recordedByUserId,
            idempotencyKey: data.idempotencyKey,
          },
        });
        const status = await recomputeStatus(tx, invoiceId);

        const newMinted = Math.max(0, roundMoney(oldEffectivePaid + data.amountPaid - invoice.netAmount));
        const creditMinted = roundMoney(newMinted - oldMinted);

        return { payment, status, creditMinted, studentId: invoice.studentId, studentUserId: invoice.student.userId };
      });
    } catch (err) {
      if (data.idempotencyKey && err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        // Lost a genuine concurrent race to another request carrying the
        // same key — that one already recorded the payment.
        const existing = await prisma.feePayment.findFirst({ where: { schoolId, idempotencyKey: data.idempotencyKey } });
        if (existing) return existing;
      }
      throw err;
    }

    const parentUserIds = await studentGuardianService.getGuardianUserIdsForStudents(schoolId, [result.studentId]);
    const creditNote = result.creditMinted > 0 ? ` (${result.creditMinted} of this was added to their fee credit balance)` : "";
    await inAppNotificationService.notifyMany(schoolId, [result.studentUserId, ...parentUserIds], {
      type: "fee_payment",
      title: "Fee payment recorded",
      body: `Payment of ${data.amountPaid} received${result.status === "PAID" ? " — invoice fully paid" : ""}${creditNote}`,
      link: "/dashboard/fees",
    });

    return result.payment;
  },

  // Applying credit is just a normal FeePayment tagged paymentMethod:
  // CREDIT — see feeLedger.ts's creditPoolFor for how that's later read back
  // out as "spent" credit. No separate ledger/application record needed.
  async applyCredit(schoolId: string, invoiceId: string, amount: number, recordedByUserId: string) {
    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.feeInvoice.findFirst({
        where: { id: invoiceId, schoolId },
        include: { payments: { include: { refunds: true } }, student: { select: { id: true, userId: true } } },
      });
      if (!invoice) throw new HttpError(404, "Invoice not found");

      await lockStudentRow(tx, invoice.studentId);

      const { balance } = ledgerFor(invoice);
      if (amount > balance) {
        throw new HttpError(400, "Credit applied cannot exceed the invoice's outstanding balance");
      }

      const pool = await creditPoolForStudent(tx, schoolId, invoice.studentId);
      if (amount > pool) {
        throw new HttpError(400, `This student only has ${roundMoney(pool)} of fee credit available`);
      }

      const payment = await tx.feePayment.create({
        data: {
          schoolId,
          invoiceId,
          amountPaid: amount,
          paymentMethod: "CREDIT",
          referenceNote: "Applied from student credit balance",
          recordedByUserId,
        },
      });
      const status = await recomputeStatus(tx, invoiceId);

      return { payment, status, studentId: invoice.studentId, studentUserId: invoice.student.userId };
    });

    const parentUserIds = await studentGuardianService.getGuardianUserIdsForStudents(schoolId, [result.studentId]);
    await inAppNotificationService.notifyMany(schoolId, [result.studentUserId, ...parentUserIds], {
      type: "fee_payment",
      title: "Fee credit applied",
      body: `${amount} of fee credit applied to an invoice${result.status === "PAID" ? " — invoice fully paid" : ""}`,
      link: "/dashboard/fees",
    });

    return result.payment;
  },

  async getCreditBalance(schoolId: string, studentId: string) {
    const pool = await prisma.$transaction((tx) => creditPoolForStudent(tx, schoolId, studentId));
    return { creditBalance: Math.max(0, pool) };
  },

  // The refund is inserted speculatively inside the transaction, then the
  // student's whole credit pool is recomputed from that (now-refunded)
  // state — if it would go negative, throwing rolls the insert back
  // automatically. This is the only way to correctly catch "this refund
  // would leave credit that's already been spent on a different invoice
  // unbacked", since the pool is derived across the student's entire
  // invoice set, not trackable per-payment (see feeLedger.ts).
  async recordRefund(schoolId: string, paymentId: string, data: { amount: number; reason: string; recordedByUserId: string }) {
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.feePayment.findFirst({
        where: { id: paymentId, schoolId },
        include: { refunds: true, invoice: { select: { id: true, studentId: true } } },
      });
      if (!payment) throw new HttpError(404, "Payment not found");

      await lockStudentRow(tx, payment.invoice.studentId);

      const alreadyRefunded = payment.refunds.reduce((sum, r) => sum + r.amount, 0);
      if (data.amount > payment.amountPaid - alreadyRefunded) {
        throw new HttpError(400, "Refund amount exceeds what remains refundable on this payment");
      }

      const refund = await tx.feeRefund.create({
        data: { schoolId, paymentId, amount: data.amount, reason: data.reason, recordedByUserId: data.recordedByUserId },
      });

      const poolAfter = await creditPoolForStudent(tx, schoolId, payment.invoice.studentId);
      if (poolAfter < 0) {
        throw new HttpError(
          400,
          `This refund would leave ${roundMoney(-poolAfter)} of this student's fee credit — already applied to another invoice — unbacked. Un-apply that credit first.`,
        );
      }

      await recomputeStatus(tx, payment.invoice.id);
      return refund;
    });
    return result;
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
