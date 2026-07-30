import { Router } from "express";
import { Role } from "@sms/db";
import { attendanceService } from "../services/attendance.service";
import { studentService } from "../services/student.service";
import { studentGuardianService } from "../services/studentGuardian.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { markAttendanceSchema, dateRangeQuerySchema } from "../validation/attendance.schema";

const MARK_ROLES: Role[] = [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.TEACHER];

export const attendanceRouter = Router();

attendanceRouter.use(authenticate);

attendanceRouter.post(
  "/",
  authorize(...MARK_ROLES),
  validateBody(markAttendanceSchema),
  async (req, res, next) => {
    try {
      const result = await attendanceService.markBulk(req.user!.schoolId, {
        ...req.body,
        markedByUserId: req.user!.sub,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

attendanceRouter.get("/", authorize(...MARK_ROLES), async (req, res, next) => {
  try {
    const { classId, sectionId, date } = req.query as {
      classId?: string;
      sectionId?: string;
      date?: string;
    };
    if (!classId || !sectionId || !date) {
      throw new HttpError(400, "classId, sectionId, and date query params are required");
    }
    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new HttpError(400, "Invalid date");
    }
    res.json(
      await attendanceService.getByClassSectionDate(req.user!.schoolId, classId, sectionId, parsedDate),
    );
  } catch (err) {
    next(err);
  }
});

async function assertCanAccessStudent(
  schoolId: string,
  user: { sub: string; role: string },
  studentId: string,
) {
  if (MARK_ROLES.includes(user.role as Role)) return;
  if (user.role === Role.STUDENT && (await studentService.isOwnStudent(schoolId, user.sub, studentId))) {
    return;
  }
  if (
    user.role === Role.PARENT &&
    (await studentGuardianService.isGuardianOfStudent(schoolId, user.sub, studentId))
  ) {
    return;
  }
  throw new HttpError(403, "You do not have permission to view this student's attendance");
}

attendanceRouter.get("/students/:studentId", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    await assertCanAccessStudent(schoolId, req.user!, req.params.studentId);

    const query = dateRangeQuerySchema.safeParse(req.query);
    if (!query.success) throw new HttpError(400, "Invalid from/to date");

    res.json(
      await attendanceService.getHistoryForStudent(
        schoolId,
        req.params.studentId,
        query.data.from,
        query.data.to,
      ),
    );
  } catch (err) {
    next(err);
  }
});

attendanceRouter.get("/students/:studentId/summary", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    await assertCanAccessStudent(schoolId, req.user!, req.params.studentId);

    const query = dateRangeQuerySchema.safeParse(req.query);
    if (!query.success) throw new HttpError(400, "Invalid from/to date");

    res.json(
      await attendanceService.getSummaryForStudent(
        schoolId,
        req.params.studentId,
        query.data.from,
        query.data.to,
      ),
    );
  } catch (err) {
    next(err);
  }
});
