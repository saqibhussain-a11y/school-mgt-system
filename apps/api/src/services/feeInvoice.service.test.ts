import { describe, expect, it } from "vitest";
import { Role } from "@sms/db";
import { feeInvoiceService } from "./feeInvoice.service";
import { HttpError } from "../middleware/errorHandler";
import {
  createTestClassSection,
  createTestFeeStructure,
  createTestSchool,
  createTestStudent,
  createTestUser,
} from "../test/helpers";

async function setupInvoice(amount = 5000) {
  const schoolId = await createTestSchool();
  const admin = await createTestUser(schoolId, Role.SCHOOL_ADMIN);
  const { classId, sectionId } = await createTestClassSection(schoolId);
  const student = await createTestStudent(schoolId, classId, sectionId);
  const structure = await createTestFeeStructure(schoolId, classId, { amount });

  const { created } = await feeInvoiceService.generate(schoolId, {
    feeStructureId: structure.id,
    period: "Term 1",
    dueDate: new Date("2026-12-01"),
    createdByUserId: admin.id,
  });
  expect(created).toBe(1);

  const [invoice] = await feeInvoiceService.listForStudent(schoolId, student.id);
  return { schoolId, admin, student, structure, invoiceId: invoice.id };
}

describe("feeInvoiceService.generate", () => {
  it("creates one invoice per active student in the fee structure's class", async () => {
    const { schoolId, invoiceId } = await setupInvoice(5000);
    const invoice = await feeInvoiceService.getById(schoolId, invoiceId);
    expect(invoice).toMatchObject({ amount: 5000, discountAmount: 0, netAmount: 5000, status: "UNPAID" });
  });

  it("does not re-invoice a student already invoiced for the same structure+period", async () => {
    const schoolId = await createTestSchool();
    const admin = await createTestUser(schoolId, Role.SCHOOL_ADMIN);
    const { classId, sectionId } = await createTestClassSection(schoolId);
    await createTestStudent(schoolId, classId, sectionId);
    const structure = await createTestFeeStructure(schoolId, classId, { amount: 3000 });

    const first = await feeInvoiceService.generate(schoolId, {
      feeStructureId: structure.id,
      period: "Term 1",
      dueDate: new Date("2026-12-01"),
      createdByUserId: admin.id,
    });
    expect(first.created).toBe(1);

    await expect(
      feeInvoiceService.generate(schoolId, {
        feeStructureId: structure.id,
        period: "Term 1",
        dueDate: new Date("2026-12-01"),
        createdByUserId: admin.id,
      }),
    ).rejects.toThrow("already have an invoice");
  });

  it("throws when there are no matching active students", async () => {
    const schoolId = await createTestSchool();
    const admin = await createTestUser(schoolId, Role.SCHOOL_ADMIN);
    const { classId } = await createTestClassSection(schoolId);
    const structure = await createTestFeeStructure(schoolId, classId, { amount: 3000 });

    await expect(
      feeInvoiceService.generate(schoolId, {
        feeStructureId: structure.id,
        period: "Term 1",
        dueDate: new Date("2026-12-01"),
        createdByUserId: admin.id,
      }),
    ).rejects.toThrow(HttpError);
  });
});

describe("feeInvoiceService.recordPayment", () => {
  it("moves status through PARTIALLY_PAID to PAID as payments accumulate", async () => {
    const { schoolId, admin, invoiceId } = await setupInvoice(1000);

    await feeInvoiceService.recordPayment(schoolId, invoiceId, { amountPaid: 400, recordedByUserId: admin.id });
    let invoice = await feeInvoiceService.getById(schoolId, invoiceId);
    expect(invoice!.status).toBe("PARTIALLY_PAID");
    expect(invoice!.balance).toBe(600);

    await feeInvoiceService.recordPayment(schoolId, invoiceId, { amountPaid: 600, recordedByUserId: admin.id });
    invoice = await feeInvoiceService.getById(schoolId, invoiceId);
    expect(invoice!.status).toBe("PAID");
    expect(invoice!.balance).toBe(0);
  });

  it("replays the same idempotencyKey as a no-op instead of double-recording", async () => {
    const { schoolId, admin, invoiceId } = await setupInvoice(1000);

    const first = await feeInvoiceService.recordPayment(schoolId, invoiceId, {
      amountPaid: 1000,
      recordedByUserId: admin.id,
      idempotencyKey: "retry-key-1",
    });
    const second = await feeInvoiceService.recordPayment(schoolId, invoiceId, {
      amountPaid: 1000,
      recordedByUserId: admin.id,
      idempotencyKey: "retry-key-1",
    });

    expect(second.id).toBe(first.id);
    const invoice = await feeInvoiceService.getById(schoolId, invoiceId);
    expect(invoice!.payments).toHaveLength(1);
  });

  it("mints fee credit for the overpaid portion, never over-crediting", async () => {
    const { schoolId, admin, student, invoiceId } = await setupInvoice(1000);

    await feeInvoiceService.recordPayment(schoolId, invoiceId, { amountPaid: 1500, recordedByUserId: admin.id });

    const invoice = await feeInvoiceService.getById(schoolId, invoiceId);
    expect(invoice!.status).toBe("PAID");
    expect(invoice!.balance).toBe(0);

    const { creditBalance } = await feeInvoiceService.getCreditBalance(schoolId, student.id);
    expect(creditBalance).toBe(500);
  });
});

describe("feeInvoiceService.applyCredit — the credit-carry invariant", () => {
  it("applies available credit to another invoice for the same student", async () => {
    const schoolId = await createTestSchool();
    const admin = await createTestUser(schoolId, Role.SCHOOL_ADMIN);
    const { classId, sectionId } = await createTestClassSection(schoolId);
    const student = await createTestStudent(schoolId, classId, sectionId);
    const structureA = await createTestFeeStructure(schoolId, classId, { category: "Tuition", amount: 1000 });
    // Exactly matches the credit minted below — applying it should fully
    // pay this invoice off, not just partially.
    const structureB = await createTestFeeStructure(schoolId, classId, { category: "Transport", amount: 200 });

    await feeInvoiceService.generate(schoolId, {
      feeStructureId: structureA.id,
      period: "Term 1",
      dueDate: new Date("2026-12-01"),
      createdByUserId: admin.id,
    });
    await feeInvoiceService.generate(schoolId, {
      feeStructureId: structureB.id,
      period: "Term 1",
      dueDate: new Date("2026-12-01"),
      createdByUserId: admin.id,
    });
    const [invoiceA, invoiceB] = await feeInvoiceService.listForStudent(schoolId, student.id);
    const tuition = [invoiceA, invoiceB].find((i) => i.netAmount === 1000)!;
    const transport = [invoiceA, invoiceB].find((i) => i.netAmount === 200)!;

    // Overpay tuition by 200 to mint credit.
    await feeInvoiceService.recordPayment(schoolId, tuition.id, { amountPaid: 1200, recordedByUserId: admin.id });
    expect((await feeInvoiceService.getCreditBalance(schoolId, student.id)).creditBalance).toBe(200);

    await feeInvoiceService.applyCredit(schoolId, transport.id, 200, admin.id);

    const transportAfter = await feeInvoiceService.getById(schoolId, transport.id);
    expect(transportAfter!.status).toBe("PAID");
    expect((await feeInvoiceService.getCreditBalance(schoolId, student.id)).creditBalance).toBe(0);
  });

  it("refuses to apply more credit than the student actually has", async () => {
    const { schoolId, admin, invoiceId } = await setupInvoice(1000);
    // No overpayment anywhere — credit pool is 0.
    await expect(feeInvoiceService.applyCredit(schoolId, invoiceId, 50, admin.id)).rejects.toThrow(
      /fee credit available/,
    );
  });

  it("refuses to apply more credit than the target invoice's own balance", async () => {
    const schoolId = await createTestSchool();
    const admin = await createTestUser(schoolId, Role.SCHOOL_ADMIN);
    const { classId, sectionId } = await createTestClassSection(schoolId);
    const student = await createTestStudent(schoolId, classId, sectionId);
    const structureA = await createTestFeeStructure(schoolId, classId, { category: "Tuition", amount: 1000 });
    const structureB = await createTestFeeStructure(schoolId, classId, { category: "Transport", amount: 100 });

    await feeInvoiceService.generate(schoolId, {
      feeStructureId: structureA.id,
      period: "Term 1",
      dueDate: new Date("2026-12-01"),
      createdByUserId: admin.id,
    });
    await feeInvoiceService.generate(schoolId, {
      feeStructureId: structureB.id,
      period: "Term 1",
      dueDate: new Date("2026-12-01"),
      createdByUserId: admin.id,
    });
    const [invoiceA, invoiceB] = await feeInvoiceService.listForStudent(schoolId, student.id);
    const tuition = [invoiceA, invoiceB].find((i) => i.netAmount === 1000)!;
    const transport = [invoiceA, invoiceB].find((i) => i.netAmount === 100)!;

    await feeInvoiceService.recordPayment(schoolId, tuition.id, { amountPaid: 1500, recordedByUserId: admin.id });
    expect((await feeInvoiceService.getCreditBalance(schoolId, student.id)).creditBalance).toBe(500);

    // 500 of credit is available, but this invoice only owes 100.
    await expect(feeInvoiceService.applyCredit(schoolId, transport.id, 200, admin.id)).rejects.toThrow(
      /outstanding balance/,
    );
  });
});

describe("feeInvoiceService.recordRefund", () => {
  it("reduces effectivePaid and reopens the invoice's status", async () => {
    const { schoolId, admin, invoiceId } = await setupInvoice(1000);
    const payment = await feeInvoiceService.recordPayment(schoolId, invoiceId, {
      amountPaid: 1000,
      recordedByUserId: admin.id,
    });

    await feeInvoiceService.recordRefund(schoolId, payment.id, {
      amount: 400,
      reason: "Overcharged",
      recordedByUserId: admin.id,
    });

    const invoice = await feeInvoiceService.getById(schoolId, invoiceId);
    expect(invoice!.status).toBe("PARTIALLY_PAID");
    expect(invoice!.balance).toBe(400);
  });

  it("refuses a refund larger than what remains refundable on the payment", async () => {
    const { schoolId, admin, invoiceId } = await setupInvoice(1000);
    const payment = await feeInvoiceService.recordPayment(schoolId, invoiceId, {
      amountPaid: 1000,
      recordedByUserId: admin.id,
    });
    await feeInvoiceService.recordRefund(schoolId, payment.id, {
      amount: 600,
      reason: "Partial refund",
      recordedByUserId: admin.id,
    });

    await expect(
      feeInvoiceService.recordRefund(schoolId, payment.id, {
        amount: 500,
        reason: "Too much — only 400 left",
        recordedByUserId: admin.id,
      }),
    ).rejects.toThrow(/exceeds what remains refundable/);
  });

  it("refuses a refund that would leave already-spent credit unbacked", async () => {
    const schoolId = await createTestSchool();
    const admin = await createTestUser(schoolId, Role.SCHOOL_ADMIN);
    const { classId, sectionId } = await createTestClassSection(schoolId);
    const student = await createTestStudent(schoolId, classId, sectionId);
    const structureA = await createTestFeeStructure(schoolId, classId, { category: "Tuition", amount: 1000 });
    const structureB = await createTestFeeStructure(schoolId, classId, { category: "Transport", amount: 300 });

    await feeInvoiceService.generate(schoolId, {
      feeStructureId: structureA.id,
      period: "Term 1",
      dueDate: new Date("2026-12-01"),
      createdByUserId: admin.id,
    });
    await feeInvoiceService.generate(schoolId, {
      feeStructureId: structureB.id,
      period: "Term 1",
      dueDate: new Date("2026-12-01"),
      createdByUserId: admin.id,
    });
    const [invoiceA, invoiceB] = await feeInvoiceService.listForStudent(schoolId, student.id);
    const tuition = [invoiceA, invoiceB].find((i) => i.netAmount === 1000)!;
    const transport = [invoiceA, invoiceB].find((i) => i.netAmount === 300)!;

    // Overpay tuition by 300, mint 300 credit, spend all of it on transport.
    const tuitionPayment = await feeInvoiceService.recordPayment(schoolId, tuition.id, {
      amountPaid: 1300,
      recordedByUserId: admin.id,
    });
    await feeInvoiceService.applyCredit(schoolId, transport.id, 300, admin.id);
    expect((await feeInvoiceService.getCreditBalance(schoolId, student.id)).creditBalance).toBe(0);

    // Refunding the original overpayment now would leave the 300 already
    // spent on transport backed by nothing — must be rejected.
    await expect(
      feeInvoiceService.recordRefund(schoolId, tuitionPayment.id, {
        amount: 300,
        reason: "Would leave spent credit unbacked",
        recordedByUserId: admin.id,
      }),
    ).rejects.toThrow(HttpError);
  });
});

describe("feeInvoiceService.updateDiscount", () => {
  it("refuses to change the discount once a payment has been recorded", async () => {
    const { schoolId, admin, invoiceId } = await setupInvoice(1000);
    await feeInvoiceService.recordPayment(schoolId, invoiceId, { amountPaid: 100, recordedByUserId: admin.id });

    await expect(feeInvoiceService.updateDiscount(schoolId, invoiceId, 50)).rejects.toThrow(
      "Cannot change the discount on an invoice that already has payments recorded",
    );
  });

  it("recomputes netAmount and status when applied before any payment", async () => {
    const { schoolId, invoiceId } = await setupInvoice(1000);
    const updated = await feeInvoiceService.updateDiscount(schoolId, invoiceId, 200);
    expect(updated).toMatchObject({ discountAmount: 200, netAmount: 800 });
  });
});
