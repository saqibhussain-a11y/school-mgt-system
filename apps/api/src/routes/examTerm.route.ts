import { Router } from "express";
import { examTermService } from "../services/examTerm.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { EXAM_ADMIN_ROLES } from "./exam.route";
import { createExamTermSchema, updateExamTermSchema } from "../validation/examTerm.schema";

export const examTermRouter = Router();
examTermRouter.use(authenticate);

examTermRouter.get("/", async (req, res, next) => {
  try {
    const academicSessionId = req.query.academicSessionId as string | undefined;
    res.json(await examTermService.list(req.user!.schoolId, academicSessionId));
  } catch (err) {
    next(err);
  }
});

examTermRouter.post("/", authorize(...EXAM_ADMIN_ROLES), validateBody(createExamTermSchema), async (req, res, next) => {
  try {
    res.status(201).json(await examTermService.create(req.user!.schoolId, req.body));
  } catch (err) {
    next(err);
  }
});

examTermRouter.patch(
  "/:id",
  authorize(...EXAM_ADMIN_ROLES),
  validateBody(updateExamTermSchema),
  async (req, res, next) => {
    try {
      const term = await examTermService.update(req.user!.schoolId, req.params.id, req.body);
      if (!term) throw new HttpError(404, "Exam term not found");
      res.json(term);
    } catch (err) {
      next(err);
    }
  },
);

examTermRouter.delete("/:id", authorize(...EXAM_ADMIN_ROLES), async (req, res, next) => {
  try {
    const term = await examTermService.remove(req.user!.schoolId, req.params.id);
    if (!term) throw new HttpError(404, "Exam term not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
