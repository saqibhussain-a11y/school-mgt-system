import { Router } from "express";
import { Role } from "@sms/db";
import { guardianService } from "../services/guardian.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { generateTempPassword } from "../lib/tempPassword";
import { createGuardianSchema, updateGuardianSchema } from "../validation/guardian.schema";

const ADMIN_ROLES = [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN];
const VIEW_ROLES = [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.TEACHER];

export const guardianRouter = Router();

guardianRouter.use(authenticate);

guardianRouter.get("/", authorize(...VIEW_ROLES), async (req, res, next) => {
  try {
    res.json(await guardianService.list(req.user!.schoolId));
  } catch (err) {
    next(err);
  }
});

guardianRouter.get("/:id", authorize(...VIEW_ROLES), async (req, res, next) => {
  try {
    const guardian = await guardianService.getById(req.user!.schoolId, req.params.id);
    if (!guardian) throw new HttpError(404, "Guardian not found");
    res.json(guardian);
  } catch (err) {
    next(err);
  }
});

guardianRouter.post(
  "/",
  authorize(...ADMIN_ROLES),
  validateBody(createGuardianSchema),
  async (req, res, next) => {
    try {
      const password = req.body.password ?? generateTempPassword();
      const guardian = await guardianService.create(req.user!.schoolId, {
        ...req.body,
        password,
      });
      res.status(201).json({
        ...guardian,
        temporaryPassword: req.body.password ? undefined : password,
      });
    } catch (err) {
      next(err);
    }
  },
);

guardianRouter.patch(
  "/:id",
  authorize(...ADMIN_ROLES),
  validateBody(updateGuardianSchema),
  async (req, res, next) => {
    try {
      const guardian = await guardianService.update(req.user!.schoolId, req.params.id, req.body);
      if (!guardian) throw new HttpError(404, "Guardian not found");
      res.json(guardian);
    } catch (err) {
      next(err);
    }
  },
);
