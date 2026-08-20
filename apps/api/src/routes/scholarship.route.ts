import { Router } from "express";
import { scholarshipService } from "../services/scholarship.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { FEE_MANAGE_ROLES } from "./feeStructure.route";
import { createScholarshipSchema, updateScholarshipSchema } from "../validation/fee.schema";

export const scholarshipRouter = Router();
scholarshipRouter.use(authenticate, authorize(...FEE_MANAGE_ROLES));

scholarshipRouter.get("/", async (req, res, next) => {
  try {
    const classId = req.query.classId as string | undefined;
    res.json(await scholarshipService.list(req.user!.schoolId, classId));
  } catch (err) {
    next(err);
  }
});

scholarshipRouter.get("/student/:studentId", async (req, res, next) => {
  try {
    res.json(await scholarshipService.listForStudent(req.user!.schoolId, req.params.studentId));
  } catch (err) {
    next(err);
  }
});

scholarshipRouter.post("/", validateBody(createScholarshipSchema), async (req, res, next) => {
  try {
    const scholarship = await scholarshipService.create(req.user!.schoolId, req.body, req.user!.sub);
    res.status(201).json(scholarship);
  } catch (err) {
    next(err);
  }
});

scholarshipRouter.patch("/:id", validateBody(updateScholarshipSchema), async (req, res, next) => {
  try {
    const scholarship = await scholarshipService.update(req.user!.schoolId, req.params.id, req.body);
    if (!scholarship) throw new HttpError(404, "Scholarship not found");
    res.json(scholarship);
  } catch (err) {
    next(err);
  }
});

scholarshipRouter.delete("/:id", async (req, res, next) => {
  try {
    const scholarship = await scholarshipService.remove(req.user!.schoolId, req.params.id);
    if (!scholarship) throw new HttpError(404, "Scholarship not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
