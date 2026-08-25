import { Router } from "express";
import { chapterService } from "../services/chapter.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { CURRICULUM_ADMIN_ROLES } from "./syllabus.route";
import { createChapterSchema, updateChapterSchema } from "../validation/chapter.schema";

export const chapterRouter = Router();
chapterRouter.use(authenticate);

chapterRouter.get("/", async (req, res, next) => {
  try {
    const syllabusId = req.query.syllabusId as string | undefined;
    if (!syllabusId) throw new HttpError(400, "syllabusId is required");
    res.json(await chapterService.list(req.user!.schoolId, syllabusId));
  } catch (err) {
    next(err);
  }
});

chapterRouter.post(
  "/",
  authorize(...CURRICULUM_ADMIN_ROLES),
  validateBody(createChapterSchema),
  async (req, res, next) => {
    try {
      res.status(201).json(await chapterService.create(req.user!.schoolId, req.body));
    } catch (err) {
      next(err);
    }
  },
);

chapterRouter.patch(
  "/:id",
  authorize(...CURRICULUM_ADMIN_ROLES),
  validateBody(updateChapterSchema),
  async (req, res, next) => {
    try {
      const chapter = await chapterService.update(req.user!.schoolId, req.params.id, req.body);
      if (!chapter) throw new HttpError(404, "Chapter not found");
      res.json(chapter);
    } catch (err) {
      next(err);
    }
  },
);

chapterRouter.delete("/:id", authorize(...CURRICULUM_ADMIN_ROLES), async (req, res, next) => {
  try {
    const chapter = await chapterService.remove(req.user!.schoolId, req.params.id);
    if (!chapter) throw new HttpError(404, "Chapter not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
