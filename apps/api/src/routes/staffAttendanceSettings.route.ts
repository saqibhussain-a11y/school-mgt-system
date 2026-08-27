import { Router } from "express";
import { Role } from "@sms/db";
import { staffAttendanceSettingsService } from "../services/staffAttendanceSettings.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { updateStaffAttendanceSettingsSchema } from "../validation/staffAttendanceSettings.schema";

const SETTINGS_ADMIN_ROLES: Role[] = [Role.SCHOOL_ADMIN, Role.PRINCIPAL];

export const staffAttendanceSettingsRouter = Router();
staffAttendanceSettingsRouter.use(authenticate);

staffAttendanceSettingsRouter.get("/", async (req, res, next) => {
  try {
    res.json(await staffAttendanceSettingsService.getOrCreate(req.user!.schoolId));
  } catch (err) {
    next(err);
  }
});

staffAttendanceSettingsRouter.patch(
  "/",
  authorize(...SETTINGS_ADMIN_ROLES),
  validateBody(updateStaffAttendanceSettingsSchema),
  async (req, res, next) => {
    try {
      res.json(await staffAttendanceSettingsService.update(req.user!.schoolId, req.body));
    } catch (err) {
      next(err);
    }
  },
);
