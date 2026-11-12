import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { Role } from "@sms/db";
import { staffAttendanceService, STAFF_PHOTO_TYPES } from "../services/staffAttendance.service";
import { staffService } from "../services/staff.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { checkInOutSchema } from "../validation/staffAttendance.schema";
import { parseDateKey, schoolToday } from "../lib/schoolTime";

const ADMIN_ROLES: Role[] = [Role.SCHOOL_ADMIN, Role.PRINCIPAL];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!Object.hasOwn(STAFF_PHOTO_TYPES, path.extname(file.originalname).toLowerCase())) {
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
        accuracy: req.body.accuracy,
        photo: { buffer: req.file.buffer, ext: path.extname(req.file.originalname).toLowerCase() },
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
        accuracy: req.body.accuracy,
        photo: { buffer: req.file.buffer, ext: path.extname(req.file.originalname).toLowerCase() },
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
    const date = dateParam ? parseDateKey(dateParam) : schoolToday();
    if (!date) throw new HttpError(400, "date must be YYYY-MM-DD");
    res.json(await staffAttendanceService.getRosterForDate(req.user!.schoolId, date));
  } catch (err) {
    next(err);
  }
});

staffAttendanceRouter.get("/report", authorize(...ADMIN_ROLES), async (req, res, next) => {
  try {
    const match = /^(\d{4})-(\d{2})$/.exec((req.query.month as string | undefined) ?? "");
    const month = match ? Number(match[2]) : 0;
    if (!match || month < 1 || month > 12) throw new HttpError(400, "month must be YYYY-MM");
    res.json(await staffAttendanceService.getMonthlyReport(req.user!.schoolId, Number(match[1]), month));
  } catch (err) {
    next(err);
  }
});
