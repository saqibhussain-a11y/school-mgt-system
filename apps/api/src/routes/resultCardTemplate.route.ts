import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { Role } from "@sms/db";
import { resultCardTemplateService } from "../services/resultCardTemplate.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { updateMarkersSchema } from "../validation/resultCardTemplate.schema";

const ADMIN_ROLES: Role[] = [Role.SCHOOL_ADMIN, Role.PRINCIPAL];

const ALLOWED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_EXTENSIONS.has(path.extname(file.originalname).toLowerCase())) {
      cb(new HttpError(400, "Upload a JPG, PNG, or WEBP image"));
      return;
    }
    cb(null, true);
  },
});

export const resultCardTemplateRouter = Router();
resultCardTemplateRouter.use(authenticate, authorize(...ADMIN_ROLES));

resultCardTemplateRouter.get("/", async (req, res, next) => {
  try {
    res.json(await resultCardTemplateService.getWithDownloadUrl(req.user!.schoolId));
  } catch (err) {
    next(err);
  }
});

resultCardTemplateRouter.post("/image", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, "No file uploaded");
    const template = await resultCardTemplateService.upsertImage(req.user!.schoolId, {
      buffer: req.file.buffer,
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });
    res.status(201).json(template);
  } catch (err) {
    next(err);
  }
});

resultCardTemplateRouter.put("/markers", validateBody(updateMarkersSchema), async (req, res, next) => {
  try {
    const template = await resultCardTemplateService.updateMarkers(req.user!.schoolId, req.body.markers);
    res.json(template);
  } catch (err) {
    next(err);
  }
});

resultCardTemplateRouter.delete("/", async (req, res, next) => {
  try {
    const template = await resultCardTemplateService.remove(req.user!.schoolId);
    if (!template) throw new HttpError(404, "No result card template configured");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
