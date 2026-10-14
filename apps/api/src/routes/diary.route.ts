import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { Role } from "@sms/db";
import { diaryService, DIARY_PHOTO_TYPES } from "../services/diary.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { parsePagination } from "../lib/pagination";
import { createDiaryEntrySchema, updateDiaryEntrySchema } from "../validation/diary.schema";

const STAFF_ROLES: Role[] = [Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.TEACHER];

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!Object.hasOwn(DIARY_PHOTO_TYPES, path.extname(file.originalname).toLowerCase())) {
      cb(new HttpError(400, "Please attach a JPG, PNG, or WEBP photo"));
      return;
    }
    cb(null, true);
  },
});

function pagination(query: Record<string, unknown>) {
  return parsePagination(query) ?? { page: 1, pageSize: 25 };
}

export const diaryRouter = Router();
diaryRouter.use(authenticate);

diaryRouter.get("/sections", authorize(...STAFF_ROLES), async (req, res, next) => {
  try {
    res.json(await diaryService.listPostableSections(req.user!.schoolId, req.user!));
  } catch (err) {
    next(err);
  }
});

diaryRouter.get("/", authorize(...STAFF_ROLES), async (req, res, next) => {
  try {
    const sectionId = req.query.sectionId as string | undefined;
    if (!sectionId) throw new HttpError(400, "sectionId is required");
    const dateRaw = req.query.date as string | undefined;
    const date = dateRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? new Date(`${dateRaw}T00:00:00Z`) : undefined;
    res.json(
      await diaryService.listForSection(req.user!.schoolId, req.user!, sectionId, pagination(req.query), date),
    );
  } catch (err) {
    next(err);
  }
});

diaryRouter.get("/student/:studentId", authorize(Role.STUDENT, Role.PARENT), async (req, res, next) => {
  try {
    res.json(
      await diaryService.listForStudent(req.user!.schoolId, req.user!, req.params.studentId, pagination(req.query)),
    );
  } catch (err) {
    next(err);
  }
});

diaryRouter.post(
  "/",
  authorize(...STAFF_ROLES),
  photoUpload.single("photo"),
  validateBody(createDiaryEntrySchema),
  async (req, res, next) => {
    try {
      const photo = req.file
        ? { buffer: req.file.buffer, ext: path.extname(req.file.originalname).toLowerCase() }
        : undefined;
      res.status(201).json(await diaryService.create(req.user!.schoolId, req.user!, req.body, photo));
    } catch (err) {
      next(err);
    }
  },
);

diaryRouter.patch("/:id", authorize(...STAFF_ROLES), validateBody(updateDiaryEntrySchema), async (req, res, next) => {
  try {
    res.json(await diaryService.updateContent(req.user!.schoolId, req.user!, req.params.id, req.body.content));
  } catch (err) {
    next(err);
  }
});

diaryRouter.delete("/:id", authorize(...STAFF_ROLES), async (req, res, next) => {
  try {
    await diaryService.remove(req.user!.schoolId, req.user!, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

diaryRouter.post("/:id/acknowledge", authorize(Role.PARENT), async (req, res, next) => {
  try {
    await diaryService.acknowledge(req.user!.schoolId, req.user!.sub, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
