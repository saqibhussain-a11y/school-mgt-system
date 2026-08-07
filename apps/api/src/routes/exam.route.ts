import { Router } from "express";
import { Role } from "@sms/db";
import { examService } from "../services/exam.service";
import { examDatesheetService } from "../services/examDatesheet.service";
import { examSeatingService } from "../services/examSeating.service";
import { buildAdmitCardsPdf } from "../lib/examAdmitCardPdf";
import { studentService } from "../services/student.service";
import { studentGuardianService } from "../services/studentGuardian.service";
import { getAssignedClassIdsForUser } from "../services/teacherAssignment.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { createExamSchema, updateExamSchema, saveMarksSchema } from "../validation/exam.schema";
import {
  generateDatesheetSchema,
  updateExamSubjectScheduleSchema,
} from "../validation/examDatesheet.schema";
import { generateSeatingSchema } from "../validation/examSeating.schema";

const ADMIN_ROLES: Role[] = [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL];

export const examRouter = Router();
export const examSubjectRouter = Router();

examRouter.use(authenticate);
examSubjectRouter.use(authenticate);

// Marks/overview management is class-scoped for a teacher — same "assigned
// to any section of this class" rule as timetable slots, since Subject (and
// therefore exams) has no section concept. Admins/principal are unrestricted.
async function assertCanManageExamClass(
  schoolId: string,
  user: { sub: string; role: string },
  classId: string,
) {
  if (ADMIN_ROLES.includes(user.role as Role)) return;
  if (user.role === Role.TEACHER) {
    const assignedClassIds = await getAssignedClassIdsForUser(schoolId, user.sub);
    if (assignedClassIds.includes(classId)) return;
  }
  throw new HttpError(403, "You do not have permission to manage marks for this class");
}

async function assertCanViewReportCard(
  schoolId: string,
  user: { sub: string; role: string },
  classId: string,
  studentId: string,
) {
  if (ADMIN_ROLES.includes(user.role as Role)) return;
  if (user.role === Role.TEACHER) {
    const assignedClassIds = await getAssignedClassIdsForUser(schoolId, user.sub);
    if (assignedClassIds.includes(classId)) return;
  }
  if (user.role === Role.STUDENT && (await studentService.isOwnStudent(schoolId, user.sub, studentId))) {
    return;
  }
  if (
    user.role === Role.PARENT &&
    (await studentGuardianService.isGuardianOfStudent(schoolId, user.sub, studentId))
  ) {
    return;
  }
  throw new HttpError(403, "You do not have permission to view this report card");
}

examRouter.get("/", async (req, res, next) => {
  try {
    const classId = req.query.classId as string | undefined;
    res.json(await examService.list(req.user!.schoolId, classId));
  } catch (err) {
    next(err);
  }
});

examRouter.get("/:id", async (req, res, next) => {
  try {
    const exam = await examService.getById(req.user!.schoolId, req.params.id);
    if (!exam) throw new HttpError(404, "Exam not found");
    res.json(exam);
  } catch (err) {
    next(err);
  }
});

examRouter.post(
  "/",
  authorize(...ADMIN_ROLES),
  validateBody(createExamSchema),
  async (req, res, next) => {
    try {
      const exam = await examService.create(req.user!.schoolId, req.body);
      res.status(201).json(exam);
    } catch (err) {
      next(err);
    }
  },
);

examRouter.patch(
  "/:id",
  authorize(...ADMIN_ROLES),
  validateBody(updateExamSchema),
  async (req, res, next) => {
    try {
      const exam = await examService.update(req.user!.schoolId, req.params.id, req.body);
      if (!exam) throw new HttpError(404, "Exam not found");
      res.json(exam);
    } catch (err) {
      next(err);
    }
  },
);

examRouter.delete("/:id", authorize(...ADMIN_ROLES), async (req, res, next) => {
  try {
    const exam = await examService.remove(req.user!.schoolId, req.params.id);
    if (!exam) throw new HttpError(404, "Exam not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

examRouter.post(
  "/:id/datesheet/generate",
  validateBody(generateDatesheetSchema),
  async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const exam = await examService.getById(schoolId, req.params.id);
      if (!exam) throw new HttpError(404, "Exam not found");
      await assertCanManageExamClass(schoolId, req.user!, exam.classId);
      res.json(await examDatesheetService.generate(schoolId, req.params.id, req.body));
    } catch (err) {
      next(err);
    }
  },
);

examSubjectRouter.patch(
  "/:id/schedule",
  validateBody(updateExamSubjectScheduleSchema),
  async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const context = await examService.getExamSubjectContext(schoolId, req.params.id);
      if (!context) throw new HttpError(404, "Exam subject not found");
      await assertCanManageExamClass(schoolId, req.user!, context.exam.classId);
      res.json(await examDatesheetService.updateSchedule(schoolId, req.params.id, req.body));
    } catch (err) {
      next(err);
    }
  },
);

examRouter.post(
  "/:id/seating/generate",
  authorize(...ADMIN_ROLES),
  validateBody(generateSeatingSchema),
  async (req, res, next) => {
    try {
      const result = await examSeatingService.generate(req.user!.schoolId, {
        examId: req.params.id,
        roomIds: req.body.roomIds,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// Read-only — unlike seat generation, this does NOT lazily create a
// session for a standalone exam; it just renders without a seat map.
examRouter.get("/:id/admit-cards", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const exam = await examService.getById(schoolId, req.params.id);
    if (!exam) throw new HttpError(404, "Exam not found");
    await assertCanManageExamClass(schoolId, req.user!, exam.classId);
    const pdf = await buildAdmitCardsPdf(schoolId, { examId: req.params.id });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="admit-cards.pdf"');
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

examRouter.get("/:id/students/:studentId/admit-card", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const exam = await examService.getById(schoolId, req.params.id);
    if (!exam) throw new HttpError(404, "Exam not found");
    await assertCanViewReportCard(schoolId, req.user!, exam.classId, req.params.studentId);
    const pdf = await buildAdmitCardsPdf(schoolId, { examId: req.params.id, studentId: req.params.studentId });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="admit-card.pdf"');
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

examRouter.get("/:id/overview", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const exam = await examService.getById(schoolId, req.params.id);
    if (!exam) throw new HttpError(404, "Exam not found");
    await assertCanManageExamClass(schoolId, req.user!, exam.classId);
    res.json(await examService.getClassOverview(schoolId, req.params.id));
  } catch (err) {
    next(err);
  }
});

examRouter.get("/:id/students/:studentId/report-card", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const exam = await examService.getById(schoolId, req.params.id);
    if (!exam) throw new HttpError(404, "Exam not found");
    await assertCanViewReportCard(schoolId, req.user!, exam.classId, req.params.studentId);
    res.json(await examService.getReportCard(schoolId, req.params.id, req.params.studentId));
  } catch (err) {
    next(err);
  }
});

examSubjectRouter.get("/:id/marks", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const context = await examService.getExamSubjectContext(schoolId, req.params.id);
    if (!context) throw new HttpError(404, "Exam subject not found");
    await assertCanManageExamClass(schoolId, req.user!, context.exam.classId);
    res.json(await examService.getMarksSheet(schoolId, req.params.id));
  } catch (err) {
    next(err);
  }
});

examSubjectRouter.post(
  "/:id/marks",
  validateBody(saveMarksSchema),
  async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const context = await examService.getExamSubjectContext(schoolId, req.params.id);
      if (!context) throw new HttpError(404, "Exam subject not found");
      await assertCanManageExamClass(schoolId, req.user!, context.exam.classId);
      const marks = await examService.saveMarksBulk(
        schoolId,
        req.params.id,
        req.body.records,
        req.user!.sub,
      );
      res.status(201).json(marks);
    } catch (err) {
      next(err);
    }
  },
);
