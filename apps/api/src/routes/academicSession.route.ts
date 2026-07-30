import { Router } from "express";
import { Role } from "@sms/db";
import { academicSessionService } from "../services/academicSession.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import {
  createAcademicSessionSchema,
  updateAcademicSessionSchema,
} from "../validation/academic.schema";

const ADMIN_ROLES = [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL];

export const academicSessionRouter = Router();

academicSessionRouter.use(authenticate);

academicSessionRouter.get("/", async (req, res, next) => {
  try {
    res.json(await academicSessionService.list(req.user!.schoolId));
  } catch (err) {
    next(err);
  }
});

academicSessionRouter.get("/:id", async (req, res, next) => {
  try {
    const session = await academicSessionService.getById(req.user!.schoolId, req.params.id);
    if (!session) throw new HttpError(404, "Academic session not found");
    res.json(session);
  } catch (err) {
    next(err);
  }
});

academicSessionRouter.post(
  "/",
  authorize(...ADMIN_ROLES),
  validateBody(createAcademicSessionSchema),
  async (req, res, next) => {
    try {
      const session = await academicSessionService.create(req.user!.schoolId, req.body);
      res.status(201).json(session);
    } catch (err) {
      next(err);
    }
  },
);

academicSessionRouter.patch(
  "/:id",
  authorize(...ADMIN_ROLES),
  validateBody(updateAcademicSessionSchema),
  async (req, res, next) => {
    try {
      const session = await academicSessionService.update(
        req.user!.schoolId,
        req.params.id,
        req.body,
      );
      if (!session) throw new HttpError(404, "Academic session not found");
      res.json(session);
    } catch (err) {
      next(err);
    }
  },
);

academicSessionRouter.delete("/:id", authorize(...ADMIN_ROLES), async (req, res, next) => {
  try {
    const session = await academicSessionService.remove(req.user!.schoolId, req.params.id);
    if (!session) throw new HttpError(404, "Academic session not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
