import { Router } from "express";
import { inAppNotificationService } from "../services/inAppNotification.service";
import { authenticate } from "../middleware/auth.middleware";
import { HttpError } from "../middleware/errorHandler";

export const notificationRouter = Router();
notificationRouter.use(authenticate);

notificationRouter.get("/", async (req, res, next) => {
  try {
    res.json(await inAppNotificationService.list(req.user!.schoolId, req.user!.sub));
  } catch (err) {
    next(err);
  }
});

notificationRouter.get("/unread-count", async (req, res, next) => {
  try {
    res.json({ count: await inAppNotificationService.unreadCount(req.user!.schoolId, req.user!.sub) });
  } catch (err) {
    next(err);
  }
});

notificationRouter.patch("/:id/read", async (req, res, next) => {
  try {
    const notification = await inAppNotificationService.markRead(
      req.user!.schoolId,
      req.user!.sub,
      req.params.id,
    );
    if (!notification) throw new HttpError(404, "Notification not found");
    res.json(notification);
  } catch (err) {
    next(err);
  }
});

notificationRouter.patch("/read-all", async (req, res, next) => {
  try {
    await inAppNotificationService.markAllRead(req.user!.schoolId, req.user!.sub);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
