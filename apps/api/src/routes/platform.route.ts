import { Router } from "express";
import { schoolService } from "../services/school.service";
import { platformAdminService } from "../services/platformAdmin.service";
import { platformDashboardService } from "../services/platformDashboard.service";
import { platformAuditLogService } from "../services/platformAuditLog.service";
import { platformReportsService } from "../services/platformReports.service";
import { systemHealthService } from "../services/systemHealth.service";
import { planService } from "../services/plan.service";
import { authenticatePlatform } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import {
  createSchoolSchema,
  updateSubscriptionSchema,
  createSchoolAdminSchema,
  updateSchoolModulesSchema,
} from "../validation/school.schema";
import { updatePlanSchema } from "../validation/plan.schema";

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

platformRouter.get("/reports", async (_req, res, next) => {
  try {
    res.json(await platformReportsService.getAll());
  } catch (err) {
    next(err);
  }
});

platformRouter.get("/system-health", async (_req, res, next) => {
  try {
    res.json(await systemHealthService.getStatus());
  } catch (err) {
    next(err);
  }
});

platformRouter.get("/plans", async (_req, res, next) => {
  try {
    res.json(await planService.list());
  } catch (err) {
    next(err);
  }
});

platformRouter.patch("/plans/:key", validateBody(updatePlanSchema), async (req, res, next) => {
  try {
    res.json(await planService.update(req.platformAdmin!.sub, req.params.key, req.body));
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

platformRouter.patch(
  "/schools/:id/modules",
  validateBody(updateSchoolModulesSchema),
  async (req, res, next) => {
    try {
      const school = await schoolService.updateModules(
        req.platformAdmin!.sub,
        req.params.id,
        req.body.enabledModules,
      );
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
