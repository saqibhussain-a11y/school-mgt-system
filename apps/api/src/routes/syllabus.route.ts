import { Router } from "express";
import { syllabusService } from "../services/syllabus.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { EXAM_ADMIN_ROLES } from "./exam.route";
import { createSyllabusSchema } from "../validation/syllabus.schema";

export const CURRICULUM_ADMIN_ROLES = EXAM_ADMIN_ROLES;

export const syllabusRouter = Router();
syllabusRouter.use(authenticate);

// Open to any authenticated role, same as Class/Section/Subject and
// TimetableSlot GETs — a pacing plan isn't sensitive the way attendance or
// grades are. A teacher's own scoped view lives at GET /me/syllabus instead.
syllabusRouter.get("/", async (req, res, next) => {
  try {
    const { academicSessionId, classId, subjectId } = req.query as Record<string, string | undefined>;
    res.json(
      await syllabusService.list(req.user!.schoolId, { academicSessionId, classId, subjectId }),
    );
  } catch (err) {
    next(err);
  }
});

syllabusRouter.get("/:id", async (req, res, next) => {
  try {
    const syllabus = await syllabusService.get(req.user!.schoolId, req.params.id);
    if (!syllabus) throw new HttpError(404, "Syllabus not found");
    res.json(syllabus);
  } catch (err) {
    next(err);
  }
});

syllabusRouter.post(
  "/",
  authorize(...CURRICULUM_ADMIN_ROLES),
  validateBody(createSyllabusSchema),
  async (req, res, next) => {
    try {
      res.status(201).json(await syllabusService.create(req.user!.schoolId, req.body));
    } catch (err) {
      next(err);
    }
  },
);

syllabusRouter.delete("/:id", authorize(...CURRICULUM_ADMIN_ROLES), async (req, res, next) => {
  try {
    const syllabus = await syllabusService.remove(req.user!.schoolId, req.params.id);
    if (!syllabus) throw new HttpError(404, "Syllabus not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
