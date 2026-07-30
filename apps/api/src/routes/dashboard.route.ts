import { Router } from "express";
import { dashboardService } from "../services/dashboard.service";
import { authenticate } from "../middleware/auth.middleware";

export const dashboardRouter = Router();

dashboardRouter.get("/", authenticate, async (req, res, next) => {
  try {
    res.json(await dashboardService.getForUser(req.user!.schoolId, req.user!));
  } catch (err) {
    next(err);
  }
});
