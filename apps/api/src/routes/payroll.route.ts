import { Router } from "express";
import { Role } from "@sms/db";
import { payrollService } from "../services/payroll.service";
import { staffService } from "../services/staff.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { requireModule } from "../lib/modules";
import { HttpError } from "../middleware/errorHandler";
import {
  setSalarySchema,
  generatePayslipsSchema,
  addAdjustmentSchema,
  updatePayslipStatusSchema,
} from "../validation/payroll.schema";

export const PAYROLL_MANAGE_ROLES: Role[] = [Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.ACCOUNTANT];

// "Has a Staff row at all", not a specific role — same convention as
// staffAttendance.route.ts's requireStaff(), since a teacher, librarian,
// accountant, etc. can all have their own payslips.
async function requireStaff(schoolId: string, userId: string) {
  const staff = await staffService.getByUserId(schoolId, userId);
  if (!staff) throw new HttpError(403, "No staff profile is linked to this account");
  return staff;
}

export const payrollRouter = Router();
payrollRouter.use(authenticate, requireModule("PAYROLL"));

payrollRouter.get("/me", async (req, res, next) => {
  try {
    const staff = await requireStaff(req.user!.schoolId, req.user!.sub);
    res.json(await payrollService.listForStaff(req.user!.schoolId, staff.id));
  } catch (err) {
    next(err);
  }
});

payrollRouter.get("/me/:id/pdf", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const staff = await requireStaff(schoolId, req.user!.sub);
    const payslip = await payrollService.getById(schoolId, req.params.id);
    if (!payslip || payslip.staffId !== staff.id) throw new HttpError(404, "Payslip not found");
    const pdf = await payrollService.getPdfBuffer(schoolId, req.params.id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="payslip-${payslip.period}.pdf"`);
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

payrollRouter.get("/staff", authorize(...PAYROLL_MANAGE_ROLES), async (req, res, next) => {
  try {
    res.json(await payrollService.listStaffForSalaries(req.user!.schoolId));
  } catch (err) {
    next(err);
  }
});

payrollRouter.get("/", authorize(...PAYROLL_MANAGE_ROLES), async (req, res, next) => {
  try {
    const { period } = req.query as { period?: string };
    res.json(await payrollService.list(req.user!.schoolId, { period }));
  } catch (err) {
    next(err);
  }
});

payrollRouter.get("/:id", authorize(...PAYROLL_MANAGE_ROLES), async (req, res, next) => {
  try {
    const payslip = await payrollService.getById(req.user!.schoolId, req.params.id);
    if (!payslip) throw new HttpError(404, "Payslip not found");
    res.json(payslip);
  } catch (err) {
    next(err);
  }
});

payrollRouter.get("/:id/pdf", authorize(...PAYROLL_MANAGE_ROLES), async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const payslip = await payrollService.getById(schoolId, req.params.id);
    if (!payslip) throw new HttpError(404, "Payslip not found");
    const pdf = await payrollService.getPdfBuffer(schoolId, req.params.id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="payslip-${payslip.period}.pdf"`);
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

payrollRouter.post(
  "/generate",
  authorize(...PAYROLL_MANAGE_ROLES),
  validateBody(generatePayslipsSchema),
  async (req, res, next) => {
    try {
      const result = await payrollService.generate(req.user!.schoolId, req.body.period, req.user!.sub);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

payrollRouter.patch(
  "/staff/:staffId/salary",
  authorize(...PAYROLL_MANAGE_ROLES),
  validateBody(setSalarySchema),
  async (req, res, next) => {
    try {
      res.json(await payrollService.setSalary(req.user!.schoolId, req.params.staffId, req.body.baseSalary));
    } catch (err) {
      next(err);
    }
  },
);

payrollRouter.post(
  "/:id/adjustments",
  authorize(...PAYROLL_MANAGE_ROLES),
  validateBody(addAdjustmentSchema),
  async (req, res, next) => {
    try {
      res.status(201).json(await payrollService.addAdjustment(req.user!.schoolId, req.params.id, req.body));
    } catch (err) {
      next(err);
    }
  },
);

payrollRouter.delete(
  "/:id/adjustments/:adjustmentId",
  authorize(...PAYROLL_MANAGE_ROLES),
  async (req, res, next) => {
    try {
      res.json(
        await payrollService.removeAdjustment(req.user!.schoolId, req.params.id, req.params.adjustmentId),
      );
    } catch (err) {
      next(err);
    }
  },
);

payrollRouter.patch(
  "/:id/status",
  authorize(...PAYROLL_MANAGE_ROLES),
  validateBody(updatePayslipStatusSchema),
  async (req, res, next) => {
    try {
      res.json(await payrollService.setStatus(req.user!.schoolId, req.params.id, req.body.status));
    } catch (err) {
      next(err);
    }
  },
);
