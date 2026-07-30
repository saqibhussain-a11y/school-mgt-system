import { Router } from "express";
import { Role } from "@sms/db";
import { classService } from "../services/class.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { createClassSchema, updateClassSchema } from "../validation/academic.schema";

const ADMIN_ROLES = [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL];

export const classRouter = Router();

classRouter.use(authenticate);

classRouter.get("/", async (req, res, next) => {
  try {
    const academicSessionId = req.query.academicSessionId as string | undefined;
    res.json(await classService.list(req.user!.schoolId, academicSessionId));
  } catch (err) {
    next(err);
  }
});

classRouter.get("/:id", async (req, res, next) => {
  try {
    const cls = await classService.getById(req.user!.schoolId, req.params.id);
    if (!cls) throw new HttpError(404, "Class not found");
    res.json(cls);
  } catch (err) {
    next(err);
  }
});

classRouter.post(
  "/",
  authorize(...ADMIN_ROLES),
  validateBody(createClassSchema),
  async (req, res, next) => {
    try {
      const cls = await classService.create(req.user!.schoolId, req.body);
      res.status(201).json(cls);
    } catch (err) {
      next(err);
    }
  },
);

classRouter.patch(
  "/:id",
  authorize(...ADMIN_ROLES),
  validateBody(updateClassSchema),
  async (req, res, next) => {
    try {
      const cls = await classService.update(req.user!.schoolId, req.params.id, req.body);
      if (!cls) throw new HttpError(404, "Class not found");
      res.json(cls);
    } catch (err) {
      next(err);
    }
  },
);

classRouter.delete("/:id", authorize(...ADMIN_ROLES), async (req, res, next) => {
  try {
    const cls = await classService.remove(req.user!.schoolId, req.params.id);
    if (!cls) throw new HttpError(404, "Class not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
