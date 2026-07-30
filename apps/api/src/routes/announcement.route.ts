import { Router } from "express";
import { Role } from "@sms/db";
import { announcementService, buildAnnouncementViewer } from "../services/announcement.service";
import { classService } from "../services/class.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { createAnnouncementSchema, updateAnnouncementSchema } from "../validation/announcement.schema";

const CREATE_ROLES: Role[] = [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.TEACHER];
const EDIT_ADMIN_ROLES: Role[] = [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL];

export const announcementRouter = Router();

announcementRouter.use(authenticate);

announcementRouter.get("/", async (req, res, next) => {
  try {
    const viewer = await buildAnnouncementViewer(req.user!.schoolId, req.user!);
    res.json(await announcementService.list(req.user!.schoolId, viewer));
  } catch (err) {
    next(err);
  }
});

announcementRouter.get("/:id", async (req, res, next) => {
  try {
    const viewer = await buildAnnouncementViewer(req.user!.schoolId, req.user!);
    const announcement = await announcementService.getVisibleById(
      req.user!.schoolId,
      req.params.id,
      viewer,
    );
    if (!announcement) throw new HttpError(404, "Announcement not found");
    res.json(announcement);
  } catch (err) {
    next(err);
  }
});

announcementRouter.post(
  "/",
  authorize(...CREATE_ROLES),
  validateBody(createAnnouncementSchema),
  async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      if (req.body.targetClassId) {
        const cls = await classService.getById(schoolId, req.body.targetClassId);
        if (!cls) throw new HttpError(400, "Class not found");
      }
      const announcement = await announcementService.create(schoolId, {
        ...req.body,
        createdBy: req.user!.sub,
      });
      res.status(201).json(announcement);
    } catch (err) {
      next(err);
    }
  },
);

function canModify(announcement: { createdBy: string }, user: { sub: string; role: string }) {
  return announcement.createdBy === user.sub || EDIT_ADMIN_ROLES.includes(user.role as Role);
}

announcementRouter.patch(
  "/:id",
  validateBody(updateAnnouncementSchema),
  async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const existing = await announcementService.getById(schoolId, req.params.id);
      if (!existing) throw new HttpError(404, "Announcement not found");
      if (!canModify(existing, req.user!)) {
        throw new HttpError(403, "You can only edit your own announcements");
      }
      if (req.body.targetClassId) {
        const cls = await classService.getById(schoolId, req.body.targetClassId);
        if (!cls) throw new HttpError(400, "Class not found");
      }
      const announcement = await announcementService.update(schoolId, req.params.id, req.body);
      res.json(announcement);
    } catch (err) {
      next(err);
    }
  },
);

announcementRouter.delete("/:id", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const existing = await announcementService.getById(schoolId, req.params.id);
    if (!existing) throw new HttpError(404, "Announcement not found");
    if (!canModify(existing, req.user!)) {
      throw new HttpError(403, "You can only delete your own announcements");
    }
    await announcementService.remove(schoolId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
