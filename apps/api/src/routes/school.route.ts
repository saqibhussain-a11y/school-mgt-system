import { Router } from "express";
import { Role } from "@sms/db";
import { schoolService } from "../services/school.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { updateSchoolProfileSchema } from "../validation/school.schema";

const PROFILE_ADMIN_ROLES = [Role.SCHOOL_ADMIN, Role.PRINCIPAL];

export const schoolRouter = Router();

// Deliberately unauthenticated (the login page needs it pre-credentials) but
// deliberately trimmed to {id, name} — see schoolService.listForLogin.
schoolRouter.get("/", async (_req, res, next) => {
  try {
    const schools = await schoolService.listForLogin();
    res.json(schools);
  } catch (err) {
    next(err);
  }
});

// The school's own profile (Settings -> School Profile), not Platform
// Admin's view (that's platform.route.ts's /schools/:id) — every
// authenticated user can read it, only admins can change it.
schoolRouter.get("/me", authenticate, async (req, res, next) => {
  try {
    res.json(await schoolService.getProfile(req.user!.schoolId));
  } catch (err) {
    next(err);
  }
});

schoolRouter.patch(
  "/me",
  authenticate,
  authorize(...PROFILE_ADMIN_ROLES),
  validateBody(updateSchoolProfileSchema),
  async (req, res, next) => {
    try {
      res.json(await schoolService.updateProfile(req.user!.schoolId, req.body));
    } catch (err) {
      next(err);
    }
  },
);
