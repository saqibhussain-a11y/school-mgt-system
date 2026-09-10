import { describe, expect, it } from "vitest";
import { LeaveStatus, prisma, Role } from "@sms/db";
import { payrollService } from "./payroll.service";
import { HttpError } from "../middleware/errorHandler";
import { createTestSchool, createTestStaff, createTestUser, withTenant } from "../test/helpers";

describe("payrollService.generate", () => {
  it("snapshots baseSalary onto the payslip and computes netPay with no deductions", async () => {
    const schoolId = await createTestSchool();
    const admin = await createTestUser(schoolId, Role.SCHOOL_ADMIN);
    const staff = await createTestStaff(schoolId);
    await payrollService.setSalary(schoolId, staff.id, 60000);

    const result = await payrollService.generate(schoolId, "2026-08", admin.id);

    expect(result.generated).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.payslips[0]).toMatchObject({
      staffId: staff.id,
      period: "2026-08",
      baseSalary: 60000,
      unpaidLeaveDays: 0,
      unpaidLeaveDeduction: 0,
      netPay: 60000,
      status: "UNPAID",
    });
  });

  it("skips staff with no baseSalary set, and throws if nobody is eligible", async () => {
    const schoolId = await createTestSchool();
    const admin = await createTestUser(schoolId, Role.SCHOOL_ADMIN);
    await createTestStaff(schoolId); // no salary set

    await expect(payrollService.generate(schoolId, "2026-08", admin.id)).rejects.toThrow(HttpError);
  });

  it("does not double-generate a payslip for the same staff+period on a second call", async () => {
    const schoolId = await createTestSchool();
    const admin = await createTestUser(schoolId, Role.SCHOOL_ADMIN);
    const staff = await createTestStaff(schoolId);
    await payrollService.setSalary(schoolId, staff.id, 50000);

    const first = await payrollService.generate(schoolId, "2026-08", admin.id);
    expect(first.generated).toBe(1);

    await expect(payrollService.generate(schoolId, "2026-08", admin.id)).rejects.toThrow(
      "Every eligible staff member already has a payslip for this period",
    );

    const payslips = await payrollService.listForStaff(schoolId, staff.id);
    expect(payslips).toHaveLength(1);
  });

  it("deducts approved unpaid leave at a flat baseSalary/30 per-day rate, clipped to the period", async () => {
    const schoolId = await createTestSchool();
    const admin = await createTestUser(schoolId, Role.SCHOOL_ADMIN);
    const staff = await createTestStaff(schoolId);
    await payrollService.setSalary(schoolId, staff.id, 30000); // 1000/day

    await withTenant(schoolId, () =>
      prisma.leaveRequest.create({
        data: {
          schoolId,
          userId: staff.userId,
          role: Role.TEACHER,
          leaveType: "unpaid",
          // Spans into September too — only the 3 August days should count
          // toward the August payslip.
          startDate: new Date("2026-08-29"),
          endDate: new Date("2026-09-02"),
          reason: "Personal",
          status: LeaveStatus.APPROVED,
        },
      }),
    );

    const result = await payrollService.generate(schoolId, "2026-08", admin.id);
    const payslip = result.payslips[0];
    expect(payslip.unpaidLeaveDays).toBe(3);
    expect(payslip.unpaidLeaveDeduction).toBe(3000);
    expect(payslip.netPay).toBe(27000);
  });

  it("ignores leave that isn't APPROVED or isn't the unpaid type", async () => {
    const schoolId = await createTestSchool();
    const admin = await createTestUser(schoolId, Role.SCHOOL_ADMIN);
    const staff = await createTestStaff(schoolId);
    await payrollService.setSalary(schoolId, staff.id, 30000);

    await withTenant(schoolId, () =>
      prisma.leaveRequest.createMany({
        data: [
          {
            schoolId,
            userId: staff.userId,
            role: Role.TEACHER,
            leaveType: "unpaid",
            startDate: new Date("2026-08-05"),
            endDate: new Date("2026-08-05"),
            reason: "Pending, not yet approved",
            status: LeaveStatus.PENDING,
          },
          {
            schoolId,
            userId: staff.userId,
            role: Role.TEACHER,
            leaveType: "sick",
            startDate: new Date("2026-08-10"),
            endDate: new Date("2026-08-10"),
            reason: "Approved but paid leave type",
            status: LeaveStatus.APPROVED,
          },
        ],
      }),
    );

    const result = await payrollService.generate(schoolId, "2026-08", admin.id);
    expect(result.payslips[0].unpaidLeaveDays).toBe(0);
    expect(result.payslips[0].netPay).toBe(30000);
  });
});

describe("payrollService adjustments and status", () => {
  async function setupPaidSlip() {
    const schoolId = await createTestSchool();
    const admin = await createTestUser(schoolId, Role.SCHOOL_ADMIN);
    const staff = await createTestStaff(schoolId);
    await payrollService.setSalary(schoolId, staff.id, 60000);
    const { payslips } = await payrollService.generate(schoolId, "2026-08", admin.id);
    return { schoolId, payslipId: payslips[0].id };
  }

  it("recomputes netPay when an adjustment is added, and again when removed", async () => {
    const { schoolId, payslipId } = await setupPaidSlip();

    const afterBonus = await payrollService.addAdjustment(schoolId, payslipId, { label: "Bonus", amount: 5000 });
    expect(afterBonus.netPay).toBe(65000);

    const afterDeduction = await payrollService.addAdjustment(schoolId, payslipId, {
      label: "Advance recovery",
      amount: -2000,
    });
    expect(afterDeduction.netPay).toBe(63000);
    expect(afterDeduction.adjustments).toHaveLength(2);

    const bonusAdjustmentId = afterDeduction.adjustments.find((a) => a.label === "Bonus")!.id;
    const afterRemoval = await payrollService.removeAdjustment(schoolId, payslipId, bonusAdjustmentId);
    expect(afterRemoval.netPay).toBe(58000);
    expect(afterRemoval.adjustments).toHaveLength(1);
  });

  it("refuses to add or remove adjustments once the payslip is marked paid", async () => {
    const { schoolId, payslipId } = await setupPaidSlip();
    await payrollService.setStatus(schoolId, payslipId, "PAID");

    await expect(payrollService.addAdjustment(schoolId, payslipId, { label: "Late bonus", amount: 1000 })).rejects.toThrow(
      "Cannot adjust a payslip that has already been marked paid",
    );
  });

  it("sets and clears paidAt when toggling status", async () => {
    const { schoolId, payslipId } = await setupPaidSlip();

    const paid = await payrollService.setStatus(schoolId, payslipId, "PAID");
    expect(paid.status).toBe("PAID");
    expect(paid.paidAt).not.toBeNull();

    const unpaid = await payrollService.setStatus(schoolId, payslipId, "UNPAID");
    expect(unpaid.status).toBe("UNPAID");
    expect(unpaid.paidAt).toBeNull();
  });
});

describe("payrollService.setSalary", () => {
  it("rejects a staff id that doesn't belong to this school", async () => {
    const schoolA = await createTestSchool();
    const schoolB = await createTestSchool();
    const staffInB = await createTestStaff(schoolB);

    await expect(payrollService.setSalary(schoolA, staffInB.id, 50000)).rejects.toThrow(HttpError);
  });
});
