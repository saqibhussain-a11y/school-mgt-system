import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { Role } from "@sms/db";
import { authenticate } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { userService } from "../services/user.service";
import { staffService } from "../services/staff.service";
import { studentService } from "../services/student.service";
import { teacherAssignmentService } from "../services/teacherAssignment.service";
import { timetableSlotService } from "../services/timetableSlot.service";
import { examInvigilationService } from "../services/examInvigilation.service";
import { syllabusService } from "../services/syllabus.service";
import { schoolService } from "../services/school.service";
import { updateProfileSchema } from "../validation/profile.schema";
import { HttpError } from "../middleware/errorHandler";

export const meRouter = Router();

const ALLOWED_AVATAR_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_AVATAR_EXTENSIONS.has(path.extname(file.originalname).toLowerCase())) {
      cb(new HttpError(400, "Please upload a JPG, PNG, WEBP, or GIF image"));
      return;
    }
    cb(null, true);
  },
});

meRouter.get("/", authenticate, async (req, res, next) => {
  try {
    const user = await userService.getById(req.user!.schoolId, req.user!.sub);
    if (!user) {
      throw new HttpError(404, "User not found");
    }
    const [enabledModules, avatarUrl] = await Promise.all([
      schoolService.getEnabledModules(user.schoolId),
      userService.avatarUrl(user),
    ]);
    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl,
      enabledModules,
    });
  } catch (err) {
    next(err);
  }
});

meRouter.get("/profile", authenticate, async (req, res, next) => {
  try {
    res.json(await userService.getProfile(req.user!.schoolId, req.user!.sub));
  } catch (err) {
    next(err);
  }
});

meRouter.patch("/profile", authenticate, validateBody(updateProfileSchema), async (req, res, next) => {
  try {
    res.json(await userService.updateProfile(req.user!.schoolId, req.user!.sub, req.body));
  } catch (err) {
    next(err);
  }
});

meRouter.post("/avatar", authenticate, avatarUpload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, "No file uploaded");
    const ext = path.extname(req.file.originalname).toLowerCase();
    res.json(
      await userService.setAvatar(req.user!.schoolId, req.user!.sub, {
        buffer: req.file.buffer,
        ext,
        contentType: req.file.mimetype,
      }),
    );
  } catch (err) {
    next(err);
  }
});

meRouter.delete("/avatar", authenticate, async (req, res, next) => {
  try {
    await userService.removeAvatar(req.user!.schoolId, req.user!.sub);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Lets a teacher's own UI (attendance marking, student filters) restrict
// itself to their assigned class/sections without needing admin rights.
meRouter.get("/assignments", authenticate, async (req, res, next) => {
  try {
    if (req.user!.role !== Role.TEACHER) {
      res.json([]);
      return;
    }
    const schoolId = req.user!.schoolId;
    const staff = await staffService.getByUserId(schoolId, req.user!.sub);
    res.json(staff ? await teacherAssignmentService.listForStaff(schoolId, staff.id) : []);
  } catch (err) {
    next(err);
  }
});

// Self-service weekly schedule: a teacher's own slots across every section
// they teach, or a student's own section's slots. Empty for every other role.
meRouter.get("/timetable", authenticate, async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    if (req.user!.role === Role.TEACHER) {
      const staff = await staffService.getByUserId(schoolId, req.user!.sub);
      res.json(staff ? await timetableSlotService.listForStaff(schoolId, staff.id) : []);
      return;
    }
    if (req.user!.role === Role.STUDENT) {
      const student = await studentService.getByUserId(schoolId, req.user!.sub);
      res.json(student ? await timetableSlotService.listForSection(schoolId, student.sectionId) : []);
      return;
    }
    res.json([]);
  } catch (err) {
    next(err);
  }
});

// A teacher's own pacing plans, scoped by subject-teaching capability
// (TeacherSubjectAssignment), not the class/section-scoped TeacherAssignment.
meRouter.get("/syllabus", authenticate, async (req, res, next) => {
  try {
    if (req.user!.role !== Role.TEACHER) {
      res.json([]);
      return;
    }
    res.json(await syllabusService.mySyllabus(req.user!.schoolId, req.user!.sub));
  } catch (err) {
    next(err);
  }
});

// Invigilation duty is assignable to ANY Staff row (a Librarian, an
// Accountant — not just teachers), so this gates on "has a Staff record at
// all", not role === TEACHER like /assignments and /timetable above.
meRouter.get("/invigilation-duties", authenticate, async (req, res, next) => {
  try {
    res.json(await examInvigilationService.myDuties(req.user!.schoolId, req.user!.sub));
  } catch (err) {
    next(err);
  }
});
