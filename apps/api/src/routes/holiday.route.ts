import { Router } from "express";
import { Role } from "@sms/db";
import { holidayService } from "../services/holiday.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { createHolidaySchema } from "../validation/holiday.schema";

const ADMIN_ROLES = [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL];

export const holidayRouter = Router();

holidayRouter.use(authenticate);

holidayRouter.get("/", async (req, res, next) => {
  try {
    res.json(await holidayService.list(req.user!.schoolId));
  } catch (err) {
    next(err);
  }
});

holidayRouter.post(
  "/",
  authorize(...ADMIN_ROLES),
  validateBody(createHolidaySchema),
  async (req, res, next) => {
    try {
      res.status(201).json(await holidayService.create(req.user!.schoolId, req.body));
    } catch (err) {
      next(err);
    }
  },
);

holidayRouter.delete("/:id", authorize(...ADMIN_ROLES), async (req, res, next) => {
  try {
    const holiday = await holidayService.remove(req.user!.schoolId, req.params.id);
    if (!holiday) throw new HttpError(404, "Holiday not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
