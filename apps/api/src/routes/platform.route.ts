import { Router } from "express";
import { schoolService } from "../services/school.service";
import { platformAdminService } from "../services/platformAdmin.service";
import { platformDashboardService } from "../services/platformDashboard.service";
import { platformAuditLogService } from "../services/platformAuditLog.service";
import { authService } from "../services/auth.service";
import { authenticatePlatform } from "../middleware/auth.middleware";
import { platformImpersonationLimiter } from "../middleware/rateLimit";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import {
  createSchoolSchema,
  updateSubscriptionSchema,
  createSchoolAdminSchema,
} from "../validation/school.schema";

export const platformRouter = Router();
platformRouter.use(authenticatePlatform);

platformRouter.get("/me", async (req, res, next) => {
  try {
    const admin = await platformAdminService.getById(req.platformAdmin!.sub);
    if (!admin) throw new HttpError(404, "Platform admin not found");
    res.json({ id: admin.id, email: admin.email, firstName: admin.firstName, lastName: admin.lastName });
  } catch (err) {
    next(err);
  }
});

platformRouter.get("/dashboard", async (_req, res, next) => {
  try {
    res.json(await platformDashboardService.getStats());
  } catch (err) {
    next(err);
  }
});

platformRouter.get("/audit-log", async (req, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    res.json(await platformAuditLogService.list(limit, cursor));
  } catch (err) {
    next(err);
  }
});

platformRouter.get("/schools", async (_req, res, next) => {
  try {
    res.json(await schoolService.listForPlatform());
  } catch (err) {
    next(err);
  }
});

platformRouter.post("/schools", validateBody(createSchoolSchema), async (req, res, next) => {
  try {
    res.status(201).json(await schoolService.create(req.platformAdmin!.sub, req.body));
  } catch (err) {
    next(err);
  }
});

platformRouter.patch(
  "/schools/:id/subscription",
  validateBody(updateSubscriptionSchema),
  async (req, res, next) => {
    try {
      const school = await schoolService.updateSubscription(req.platformAdmin!.sub, req.params.id, req.body);
      if (!school) throw new HttpError(404, "School not found");
      res.json(school);
    } catch (err) {
      next(err);
    }
  },
);

platformRouter.get("/schools/:id/usage", async (req, res, next) => {
  try {
    res.json(await schoolService.getUsage(req.params.id));
  } catch (err) {
    next(err);
  }
});

platformRouter.get("/schools/:id/admins", async (req, res, next) => {
  try {
    res.json(await schoolService.getAdmins(req.params.id));
  } catch (err) {
    next(err);
  }
});

platformRouter.post(
  "/schools/:id/admins",
  validateBody(createSchoolAdminSchema),
  async (req, res, next) => {
    try {
      res.status(201).json(await schoolService.createAdmin(req.platformAdmin!.sub, req.params.id, req.body));
    } catch (err) {
      next(err);
    }
  },
);

platformRouter.post("/schools/:id/admins/:adminId/reset-password", async (req, res, next) => {
  try {
    res.json(await schoolService.resetAdminPassword(req.platformAdmin!.sub, req.params.id, req.params.adminId));
  } catch (err) {
    next(err);
  }
});

platformRouter.post(
  "/schools/:id/impersonate",
  platformImpersonationLimiter,
  async (req, res, next) => {
    try {
      const targetUser = await schoolService.getOldestAdmin(req.params.id);
      if (!targetUser) throw new HttpError(404, "This school has no admin account to impersonate");

      const platformAdminId = req.platformAdmin!.sub;
      const accessToken = authService.issueImpersonationToken(platformAdminId, targetUser);
      await platformAuditLogService.recordStandalone(platformAdminId, {
        action: "school.impersonate",
        targetType: "School",
        targetId: req.params.id,
        metadata: { targetUserId: targetUser.id, targetUserEmail: targetUser.email },
      });

      res.json({ accessToken, schoolId: targetUser.schoolId });
    } catch (err) {
      next(err);
    }
  },
);
