import { Router } from "express";
import { dashboardService } from "../services/dashboard.service";
import { authenticate } from "../middleware/auth.middleware";
import { getOrSet } from "../lib/cache";

export const dashboardRouter = Router();

// Keyed per-user, not just per-school — recentAnnouncements is built from a
// viewer that depends on the caller's own role/section assignment, so two
// users at the same school can legitimately see different widgets. A short
// 30s TTL (shorter than the report trend caches) since todayAttendancePercent
// is meant to reflect attendance being marked live through the school day.
dashboardRouter.get("/", authenticate, async (req, res, next) => {
  try {
    const { schoolId, sub, role } = req.user!;
    const cacheKey = `dashboard:${schoolId}:${sub}:${role}`;
    const data = await getOrSet(cacheKey, 30, () => dashboardService.getForUser(schoolId, req.user!));
    res.json(data);
  } catch (err) {
    next(err);
  }
});
