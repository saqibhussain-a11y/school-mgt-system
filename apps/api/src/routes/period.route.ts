import { Router } from "express";
import { Role } from "@sms/db";
import { periodService } from "../services/period.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { createPeriodSchema, updatePeriodSchema } from "../validation/period.schema";

const ADMIN_ROLES = [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL];

export const periodRouter = Router();

periodRouter.use(authenticate);

periodRouter.get("/", async (req, res, next) => {
  try {
    res.json(await periodService.list(req.user!.schoolId));
  } catch (err) {
    next(err);
  }
});

periodRouter.post(
  "/",
  authorize(...ADMIN_ROLES),
  validateBody(createPeriodSchema),
  async (req, res, next) => {
    try {
      res.status(201).json(await periodService.create(req.user!.schoolId, req.body));
    } catch (err) {
      next(err);
    }
  },
);

periodRouter.patch(
  "/:id",
  authorize(...ADMIN_ROLES),
  validateBody(updatePeriodSchema),
  async (req, res, next) => {
    try {
      const period = await periodService.update(req.user!.schoolId, req.params.id, req.body);
      if (!period) throw new HttpError(404, "Period not found");
      res.json(period);
    } catch (err) {
      next(err);
    }
  },
);

periodRouter.delete("/:id", authorize(...ADMIN_ROLES), async (req, res, next) => {
  try {
    const period = await periodService.remove(req.user!.schoolId, req.params.id);
    if (!period) throw new HttpError(404, "Period not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
