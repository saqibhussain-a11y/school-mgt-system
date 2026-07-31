import { Router } from "express";
import { Role, FeeInvoiceStatus } from "@sms/db";
import { feeInvoiceService } from "../services/feeInvoice.service";
import { studentService } from "../services/student.service";
import { studentGuardianService } from "../services/studentGuardian.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { FEE_MANAGE_ROLES } from "./feeStructure.route";
import {
  generateInvoicesSchema,
  updateInvoiceDiscountSchema,
  recordPaymentSchema,
  recordRefundSchema,
} from "../validation/fee.schema";

async function assertCanViewStudentFees(schoolId: string, user: { sub: string; role: string }, studentId: string) {
  if (FEE_MANAGE_ROLES.includes(user.role as Role)) return;
  if (user.role === Role.STUDENT && (await studentService.isOwnStudent(schoolId, user.sub, studentId))) return;
  if (
    user.role === Role.PARENT &&
    (await studentGuardianService.isGuardianOfStudent(schoolId, user.sub, studentId))
  ) {
    return;
  }
  throw new HttpError(403, "You do not have permission to view these fee records");
}

export const feeInvoiceRouter = Router();
feeInvoiceRouter.use(authenticate);

feeInvoiceRouter.get("/", authorize(...FEE_MANAGE_ROLES), async (req, res, next) => {
  try {
    const { classId, status, overdue } = req.query as { classId?: string; status?: FeeInvoiceStatus; overdue?: string };
    res.json(await feeInvoiceService.list(req.user!.schoolId, { classId, status, overdue: overdue === "true" }));
  } catch (err) {
    next(err);
  }
});

feeInvoiceRouter.get("/summary", authorize(...FEE_MANAGE_ROLES), async (req, res, next) => {
  try {
    const { classId, period } = req.query as { classId?: string; period?: string };
    res.json(await feeInvoiceService.summary(req.user!.schoolId, { classId, period }));
  } catch (err) {
    next(err);
  }
});

feeInvoiceRouter.get("/me", authorize(Role.STUDENT), async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const student = await studentService.getByUserId(schoolId, req.user!.sub);
    if (!student) throw new HttpError(404, "No student profile linked to this account");
    res.json(await feeInvoiceService.listForStudent(schoolId, student.id));
  } catch (err) {
    next(err);
  }
});

feeInvoiceRouter.get("/student/:studentId", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    await assertCanViewStudentFees(schoolId, req.user!, req.params.studentId);
    res.json(await feeInvoiceService.listForStudent(schoolId, req.params.studentId));
  } catch (err) {
    next(err);
  }
});

feeInvoiceRouter.get("/:id", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const invoice = await feeInvoiceService.getById(schoolId, req.params.id);
    if (!invoice) throw new HttpError(404, "Invoice not found");
    await assertCanViewStudentFees(schoolId, req.user!, invoice.studentId);
    res.json(invoice);
  } catch (err) {
    next(err);
  }
});

feeInvoiceRouter.post(
  "/generate",
  authorize(...FEE_MANAGE_ROLES),
  validateBody(generateInvoicesSchema),
  async (req, res, next) => {
    try {
      const result = await feeInvoiceService.generate(req.user!.schoolId, {
        ...req.body,
        createdByUserId: req.user!.sub,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

feeInvoiceRouter.patch(
  "/:id/discount",
  authorize(...FEE_MANAGE_ROLES),
  validateBody(updateInvoiceDiscountSchema),
  async (req, res, next) => {
    try {
      const invoice = await feeInvoiceService.updateDiscount(
        req.user!.schoolId,
        req.params.id,
        req.body.discountAmount,
      );
      if (!invoice) throw new HttpError(404, "Invoice not found");
      res.json(invoice);
    } catch (err) {
      next(err);
    }
  },
);

feeInvoiceRouter.delete("/:id", authorize(...FEE_MANAGE_ROLES), async (req, res, next) => {
  try {
    const invoice = await feeInvoiceService.remove(req.user!.schoolId, req.params.id);
    if (!invoice) throw new HttpError(404, "Invoice not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

feeInvoiceRouter.post(
  "/:id/payments",
  authorize(...FEE_MANAGE_ROLES),
  validateBody(recordPaymentSchema),
  async (req, res, next) => {
    try {
      const payment = await feeInvoiceService.recordPayment(req.user!.schoolId, req.params.id, {
        ...req.body,
        recordedByUserId: req.user!.sub,
      });
      res.status(201).json(payment);
    } catch (err) {
      next(err);
    }
  },
);

feeInvoiceRouter.post("/:id/remind", authorize(...FEE_MANAGE_ROLES), async (req, res, next) => {
  try {
    await feeInvoiceService.remind(req.user!.schoolId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export const feePaymentRouter = Router();
feePaymentRouter.use(authenticate, authorize(...FEE_MANAGE_ROLES));

feePaymentRouter.post("/:id/refund", validateBody(recordRefundSchema), async (req, res, next) => {
  try {
    const refund = await feeInvoiceService.recordRefund(req.user!.schoolId, req.params.id, {
      ...req.body,
      recordedByUserId: req.user!.sub,
    });
    res.status(201).json(refund);
  } catch (err) {
    next(err);
  }
});
