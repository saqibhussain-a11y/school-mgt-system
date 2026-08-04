import { Router } from "express";
import { Role } from "@sms/db";
import { schoolService } from "../services/school.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { createSchoolSchema, updateSubscriptionSchema } from "../validation/school.schema";

// Platform-wide administration — spans every tenant, gated to SUPER_ADMIN
// (the master doc's "you, the SaaS owner" role). Every handler here calls
// into schoolService functions that explicitly run outside tenant scoping
// (runAsPlatform) since there is no single schoolId to filter by.
export const platformRouter = Router();
platformRouter.use(authenticate, authorize(Role.SUPER_ADMIN));

platformRouter.get("/schools", async (_req, res, next) => {
  try {
    res.json(await schoolService.listForPlatform());
  } catch (err) {
    next(err);
  }
});

platformRouter.post("/schools", validateBody(createSchoolSchema), async (req, res, next) => {
  try {
    res.status(201).json(await schoolService.create(req.body));
  } catch (err) {
    next(err);
  }
});

platformRouter.patch(
  "/schools/:id/subscription",
  validateBody(updateSubscriptionSchema),
  async (req, res, next) => {
    try {
      const school = await schoolService.updateSubscription(req.params.id, req.body);
      if (!school) throw new HttpError(404, "School not found");
      res.json(school);
    } catch (err) {
      next(err);
    }
  },
);
