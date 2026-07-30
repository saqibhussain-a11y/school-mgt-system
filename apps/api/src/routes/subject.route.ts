import { Router } from "express";
import { Role } from "@sms/db";
import { subjectService } from "../services/subject.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { createSubjectSchema, updateSubjectSchema } from "../validation/academic.schema";

const ADMIN_ROLES = [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL];

export const subjectRouter = Router();

subjectRouter.use(authenticate);

subjectRouter.get("/", async (req, res, next) => {
  try {
    const classId = req.query.classId as string | undefined;
    res.json(await subjectService.list(req.user!.schoolId, classId));
  } catch (err) {
    next(err);
  }
});

subjectRouter.get("/:id", async (req, res, next) => {
  try {
    const subject = await subjectService.getById(req.user!.schoolId, req.params.id);
    if (!subject) throw new HttpError(404, "Subject not found");
    res.json(subject);
  } catch (err) {
    next(err);
  }
});

subjectRouter.post(
  "/",
  authorize(...ADMIN_ROLES),
  validateBody(createSubjectSchema),
  async (req, res, next) => {
    try {
      const subject = await subjectService.create(req.user!.schoolId, req.body);
      res.status(201).json(subject);
    } catch (err) {
      next(err);
    }
  },
);

subjectRouter.patch(
  "/:id",
  authorize(...ADMIN_ROLES),
  validateBody(updateSubjectSchema),
  async (req, res, next) => {
    try {
      const subject = await subjectService.update(req.user!.schoolId, req.params.id, req.body);
      if (!subject) throw new HttpError(404, "Subject not found");
      res.json(subject);
    } catch (err) {
      next(err);
    }
  },
);

subjectRouter.delete("/:id", authorize(...ADMIN_ROLES), async (req, res, next) => {
  try {
    const subject = await subjectService.remove(req.user!.schoolId, req.params.id);
    if (!subject) throw new HttpError(404, "Subject not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
