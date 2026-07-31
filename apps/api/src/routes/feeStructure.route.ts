import { Router } from "express";
import { Role } from "@sms/db";
import { feeStructureService } from "../services/feeStructure.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { createFeeStructureSchema, updateFeeStructureSchema } from "../validation/fee.schema";

// Financial data — deliberately narrower than most staff-facing modules.
// No TEACHER access (privacy — fee amounts/discounts aren't academic data).
export const FEE_MANAGE_ROLES: Role[] = [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.ACCOUNTANT];

export const feeStructureRouter = Router();
feeStructureRouter.use(authenticate, authorize(...FEE_MANAGE_ROLES));

feeStructureRouter.get("/", async (req, res, next) => {
  try {
    const classId = req.query.classId as string | undefined;
    res.json(await feeStructureService.list(req.user!.schoolId, classId));
  } catch (err) {
    next(err);
  }
});

feeStructureRouter.post("/", validateBody(createFeeStructureSchema), async (req, res, next) => {
  try {
    res.status(201).json(await feeStructureService.create(req.user!.schoolId, req.body));
  } catch (err) {
    next(err);
  }
});

feeStructureRouter.patch("/:id", validateBody(updateFeeStructureSchema), async (req, res, next) => {
  try {
    const structure = await feeStructureService.update(req.user!.schoolId, req.params.id, req.body);
    if (!structure) throw new HttpError(404, "Fee structure not found");
    res.json(structure);
  } catch (err) {
    next(err);
  }
});

feeStructureRouter.delete("/:id", async (req, res, next) => {
  try {
    const structure = await feeStructureService.remove(req.user!.schoolId, req.params.id);
    if (!structure) throw new HttpError(404, "Fee structure not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
