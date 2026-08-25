import { Router } from "express";
import { scheduleEntryService } from "../services/scheduleEntry.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { CURRICULUM_ADMIN_ROLES } from "./syllabus.route";
import {
  createScheduleEntrySchema,
  updateScheduleEntrySchema,
  bulkGenerateScheduleSchema,
} from "../validation/scheduleEntry.schema";

export const scheduleEntryRouter = Router();
scheduleEntryRouter.use(authenticate);

scheduleEntryRouter.get("/", async (req, res, next) => {
  try {
    const chapterId = req.query.chapterId as string | undefined;
    if (!chapterId) throw new HttpError(400, "chapterId is required");
    res.json(await scheduleEntryService.list(req.user!.schoolId, chapterId));
  } catch (err) {
    next(err);
  }
});

scheduleEntryRouter.post(
  "/",
  authorize(...CURRICULUM_ADMIN_ROLES),
  validateBody(createScheduleEntrySchema),
  async (req, res, next) => {
    try {
      res.status(201).json(await scheduleEntryService.create(req.user!.schoolId, req.body));
    } catch (err) {
      next(err);
    }
  },
);

scheduleEntryRouter.post(
  "/bulk-generate",
  authorize(...CURRICULUM_ADMIN_ROLES),
  validateBody(bulkGenerateScheduleSchema),
  async (req, res, next) => {
    try {
      res.status(201).json(await scheduleEntryService.bulkGenerate(req.user!.schoolId, req.body));
    } catch (err) {
      next(err);
    }
  },
);

scheduleEntryRouter.patch(
  "/:id",
  authorize(...CURRICULUM_ADMIN_ROLES),
  validateBody(updateScheduleEntrySchema),
  async (req, res, next) => {
    try {
      const entry = await scheduleEntryService.update(req.user!.schoolId, req.params.id, req.body);
      if (!entry) throw new HttpError(404, "Schedule entry not found");
      res.json(entry);
    } catch (err) {
      next(err);
    }
  },
);

scheduleEntryRouter.delete("/:id", authorize(...CURRICULUM_ADMIN_ROLES), async (req, res, next) => {
  try {
    const entry = await scheduleEntryService.remove(req.user!.schoolId, req.params.id);
    if (!entry) throw new HttpError(404, "Schedule entry not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
