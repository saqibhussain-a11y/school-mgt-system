import { Router } from "express";
import { Role } from "@sms/db";
import { admissionNumberFormatService } from "../services/admissionNumberFormat.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { updateAdmissionNumberFormatSchema } from "../validation/admissionNumberFormat.schema";

const FORMAT_ADMIN_ROLES: Role[] = [Role.SCHOOL_ADMIN, Role.PRINCIPAL];

export const admissionNumberFormatRouter = Router();

admissionNumberFormatRouter.use(authenticate, authorize(...FORMAT_ADMIN_ROLES));

admissionNumberFormatRouter.get("/", async (req, res, next) => {
  try {
    res.json(await admissionNumberFormatService.get(req.user!.schoolId));
  } catch (err) {
    next(err);
  }
});

admissionNumberFormatRouter.patch(
  "/",
  validateBody(updateAdmissionNumberFormatSchema),
  async (req, res, next) => {
    try {
      res.json(await admissionNumberFormatService.update(req.user!.schoolId, req.body));
    } catch (err) {
      next(err);
    }
  },
);
