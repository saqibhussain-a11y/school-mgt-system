import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { Role } from "@sms/db";
import { staffAttendanceService } from "../services/staffAttendance.service";
import { staffService } from "../services/staff.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { checkInOutSchema } from "../validation/staffAttendance.schema";

const ADMIN_ROLES: Role[] = [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL];

const ALLOWED_PHOTO_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_PHOTO_EXTENSIONS.has(path.extname(file.originalname).toLowerCase())) {
      cb(new HttpError(400, "Upload a JPG, PNG, or WEBP photo"));
      return;
    }
    cb(null, true);
  },
});

async function requireStaff(schoolId: string, userId: string) {
  const staff = await staffService.getByUserId(schoolId, userId);
  if (!staff) throw new HttpError(403, "No staff profile is linked to this account");
  return staff;
}

export const staffAttendanceRouter = Router();
staffAttendanceRouter.use(authenticate);

staffAttendanceRouter.post(
  "/check-in",
  upload.single("photo"),
  validateBody(checkInOutSchema),
  async (req, res, next) => {
    try {
      if (!req.file) throw new HttpError(400, "A photo is required to check in");
      const schoolId = req.user!.schoolId;
      const staff = await requireStaff(schoolId, req.user!.sub);
      const row = await staffAttendanceService.checkIn(schoolId, staff.id, {
        lat: req.body.lat,
        lng: req.body.lng,
        photo: { buffer: req.file.buffer, filename: req.file.originalname, contentType: req.file.mimetype },
      });
      res.status(201).json(row);
    } catch (err) {
      next(err);
    }
  },
);

staffAttendanceRouter.post(
  "/check-out",
  upload.single("photo"),
  validateBody(checkInOutSchema),
  async (req, res, next) => {
    try {
      if (!req.file) throw new HttpError(400, "A photo is required to check out");
      const schoolId = req.user!.schoolId;
      const staff = await requireStaff(schoolId, req.user!.sub);
      const row = await staffAttendanceService.checkOut(schoolId, staff.id, {
        lat: req.body.lat,
        lng: req.body.lng,
        photo: { buffer: req.file.buffer, filename: req.file.originalname, contentType: req.file.mimetype },
      });
      res.json(row);
    } catch (err) {
      next(err);
    }
  },
);

staffAttendanceRouter.get("/me/today", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const staff = await requireStaff(schoolId, req.user!.sub);
    res.json(await staffAttendanceService.getToday(schoolId, staff.id));
  } catch (err) {
    next(err);
  }
});

staffAttendanceRouter.get("/me/history", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const staff = await requireStaff(schoolId, req.user!.sub);
    res.json(await staffAttendanceService.listForStaff(schoolId, staff.id));
  } catch (err) {
    next(err);
  }
});

staffAttendanceRouter.get("/roster", authorize(...ADMIN_ROLES), async (req, res, next) => {
  try {
    const dateParam = req.query.date as string | undefined;
    const date = dateParam ? new Date(`${dateParam}T00:00:00.000Z`) : new Date();
    const normalized = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    res.json(await staffAttendanceService.getRosterForDate(req.user!.schoolId, normalized));
  } catch (err) {
    next(err);
  }
});
