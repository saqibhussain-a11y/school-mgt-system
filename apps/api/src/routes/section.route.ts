import { Router } from "express";
import { Role } from "@sms/db";
import { sectionService } from "../services/section.service";
import { teacherAssignmentService } from "../services/teacherAssignment.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { createSectionSchema, updateSectionSchema } from "../validation/academic.schema";

const ADMIN_ROLES = [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL];

export const sectionRouter = Router();

sectionRouter.use(authenticate);

sectionRouter.get("/", async (req, res, next) => {
  try {
    const classId = req.query.classId as string | undefined;
    res.json(await sectionService.list(req.user!.schoolId, classId));
  } catch (err) {
    next(err);
  }
});

sectionRouter.get("/:id", async (req, res, next) => {
  try {
    const section = await sectionService.getById(req.user!.schoolId, req.params.id);
    if (!section) throw new HttpError(404, "Section not found");
    res.json(section);
  } catch (err) {
    next(err);
  }
});

sectionRouter.get("/:id/teachers", authorize(...ADMIN_ROLES), async (req, res, next) => {
  try {
    res.json(await teacherAssignmentService.listForSection(req.user!.schoolId, req.params.id));
  } catch (err) {
    next(err);
  }
});

sectionRouter.post(
  "/",
  authorize(...ADMIN_ROLES),
  validateBody(createSectionSchema),
  async (req, res, next) => {
    try {
      const section = await sectionService.create(req.user!.schoolId, req.body);
      res.status(201).json(section);
    } catch (err) {
      next(err);
    }
  },
);

sectionRouter.patch(
  "/:id",
  authorize(...ADMIN_ROLES),
  validateBody(updateSectionSchema),
  async (req, res, next) => {
    try {
      const section = await sectionService.update(req.user!.schoolId, req.params.id, req.body);
      if (!section) throw new HttpError(404, "Section not found");
      res.json(section);
    } catch (err) {
      next(err);
    }
  },
);

sectionRouter.delete("/:id", authorize(...ADMIN_ROLES), async (req, res, next) => {
  try {
    const section = await sectionService.remove(req.user!.schoolId, req.params.id);
    if (!section) throw new HttpError(404, "Section not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
