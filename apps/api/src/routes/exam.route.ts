import { Router } from "express";
import { Role } from "@sms/db";
import { examService } from "../services/exam.service";
import { examDatesheetService } from "../services/examDatesheet.service";
import { examSeatingService } from "../services/examSeating.service";
import { buildAdmitCardsPdf } from "../lib/examAdmitCardPdf";
import { buildResultCardsPdf } from "../lib/resultCardPdf";
import { generateReportPdf } from "../lib/reportPdf";
import { reportsService } from "../services/reports.service";
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
  schedulePreviewQuerySchema,
} from "../validation/examDatesheet.schema";
import { generateSeatingSchema } from "../validation/examSeating.schema";

export const EXAM_ADMIN_ROLES: Role[] = [Role.SCHOOL_ADMIN, Role.PRINCIPAL];
const ADMIN_ROLES = EXAM_ADMIN_ROLES;

export const examRouter = Router();
export const examSubjectRouter = Router();

examRouter.use(authenticate);
examSubjectRouter.use(authenticate);

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

async function assertCanViewExam(
  schoolId: string,
  user: { sub: string; role: string },
  classId: string,
) {
  if (ADMIN_ROLES.includes(user.role as Role)) return;
  if (user.role === Role.TEACHER) {
    const assignedClassIds = await getAssignedClassIdsForUser(schoolId, user.sub);
    if (assignedClassIds.includes(classId)) return;
  }
  if (user.role === Role.STUDENT) {
    const student = await studentService.getByUserId(schoolId, user.sub);
    if (student?.classId === classId) return;
  }
  if (user.role === Role.PARENT) {
    const children = await studentGuardianService.getChildrenForGuardianUser(schoolId, user.sub);
    if (children.some((c) => c.classId === classId)) return;
  }
  throw new HttpError(403, "You do not have permission to view exams for this class");
}

async function getViewableClassIds(
  schoolId: string,
  user: { sub: string; role: string },
): Promise<string[] | null> {
  if (ADMIN_ROLES.includes(user.role as Role)) return null;
  if (user.role === Role.TEACHER) return getAssignedClassIdsForUser(schoolId, user.sub);
  if (user.role === Role.STUDENT) {
    const student = await studentService.getByUserId(schoolId, user.sub);
    return student ? [student.classId] : [];
  }
  if (user.role === Role.PARENT) {
    const children = await studentGuardianService.getChildrenForGuardianUser(schoolId, user.sub);
    return children.map((c) => c.classId);
  }
  return [];
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
    const schoolId = req.user!.schoolId;
    const classId = req.query.classId as string | undefined;
    if (classId) {
      await assertCanViewExam(schoolId, req.user!, classId);
      res.json(await examService.list(schoolId, classId));
    } else {
      const viewableClassIds = await getViewableClassIds(schoolId, req.user!);
      res.json(await examService.list(schoolId, undefined, viewableClassIds ?? undefined));
    }
  } catch (err) {
    next(err);
  }
});

examRouter.get("/:id", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const exam = await examService.getById(schoolId, req.params.id);
    if (!exam) throw new HttpError(404, "Exam not found");
    await assertCanViewExam(schoolId, req.user!, exam.classId);
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

examSubjectRouter.get("/:id/schedule-siblings", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const context = await examService.getExamSubjectContext(schoolId, req.params.id);
    if (!context) throw new HttpError(404, "Exam subject not found");
    await assertCanManageExamClass(schoolId, req.user!, context.exam.classId);
    const query = schedulePreviewQuerySchema.safeParse(req.query);
    if (!query.success) throw new HttpError(400, query.error.issues.map((i) => i.message).join(", "));
    res.json(await examDatesheetService.previewSiblingSync(schoolId, req.params.id, query.data, req.user!));
  } catch (err) {
    next(err);
  }
});

examSubjectRouter.patch(
  "/:id/schedule",
  validateBody(updateExamSubjectScheduleSchema),
  async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const context = await examService.getExamSubjectContext(schoolId, req.params.id);
      if (!context) throw new HttpError(404, "Exam subject not found");
      await assertCanManageExamClass(schoolId, req.user!, context.exam.classId);
      res.json(await examDatesheetService.updateSchedule(schoolId, req.params.id, req.body, req.user!));
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

examRouter.get("/:id/result-sheet", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const exam = await examService.getById(schoolId, req.params.id);
    if (!exam) throw new HttpError(404, "Exam not found");
    await assertCanManageExamClass(schoolId, req.user!, exam.classId);
    res.json(await examService.getClassResultSheet(schoolId, req.params.id));
  } catch (err) {
    next(err);
  }
});

const RESULT_SHEET_PAGE_WIDTH = 475;
const RESULT_SHEET_FIXED_COLUMNS_WIDTH = 100 + 65 + 55 + 45 + 40; 

examRouter.get("/:id/result-sheet/pdf", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const exam = await examService.getById(schoolId, req.params.id);
    if (!exam) throw new HttpError(404, "Exam not found");
    await assertCanManageExamClass(schoolId, req.user!, exam.classId);
    const sheet = await examService.getClassResultSheet(schoolId, req.params.id);

    const subjectColWidth = Math.max(28, Math.floor((RESULT_SHEET_PAGE_WIDTH - RESULT_SHEET_FIXED_COLUMNS_WIDTH) / Math.max(1, sheet.subjects.length)));
    const columns = [
      { key: "student", label: "Student", width: 100 },
      { key: "admissionNo", label: "Adm. No.", width: 65 },
      ...sheet.subjects.map((s) => ({ key: s.subjectId, label: s.subjectName, width: subjectColWidth })),
      { key: "overall", label: "Overall %", width: 55 },
      { key: "grade", label: "Grade", width: 45 },
      { key: "rank", label: "Rank", width: 40 },
    ];
    const rows = sheet.students.map((student) => {
      const row: Record<string, unknown> = {
        student: `${student.firstName} ${student.lastName}`,
        admissionNo: student.admissionNo,
        overall: student.overallPercentage ?? "—",
        grade: student.overallGrade ?? "—",
        rank: student.rank ?? "—",
      };
      for (const sm of student.subjectMarks) {
        row[sm.subjectId] = sm.isAbsent ? "Absent" : sm.marksObtained ?? "—";
      }
      return row;
    });

    const schoolName = await reportsService.getSchoolName(schoolId);
    const pdf = await generateReportPdf(schoolName, `${exam.name} — Class Result Sheet`, columns, rows);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="class-result-sheet.pdf"');
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

examRouter.get("/:id/result-cards/pdf", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const exam = await examService.getById(schoolId, req.params.id);
    if (!exam) throw new HttpError(404, "Exam not found");
    await assertCanManageExamClass(schoolId, req.user!, exam.classId);
    const mode = req.query.mode === "FULL" ? "FULL" : "OVERLAY";
    const pdf = await buildResultCardsPdf(schoolId, req.params.id, mode);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="result-cards.pdf"');
    res.send(pdf);
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
    if ((req.user!.role === Role.STUDENT || req.user!.role === Role.PARENT) && exam.status !== "PUBLISHED") {
      throw new HttpError(403, "Results for this exam have not been published yet");
    }
    res.json(await examService.getReportCard(schoolId, req.params.id, req.params.studentId));
  } catch (err) {
    next(err);
  }
});

examRouter.post("/:id/publish", authorize(...ADMIN_ROLES), async (req, res, next) => {
  try {
    const exam = await examService.publish(req.user!.schoolId, req.params.id);
    if (!exam) throw new HttpError(404, "Exam not found");
    res.json(exam);
  } catch (err) {
    next(err);
  }
});

examRouter.post("/:id/unpublish", authorize(...ADMIN_ROLES), async (req, res, next) => {
  try {
    const exam = await examService.unpublish(req.user!.schoolId, req.params.id);
    if (!exam) throw new HttpError(404, "Exam not found");
    res.json(exam);
  } catch (err) {
    next(err);
  }
});

examRouter.get("/:id/completeness", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const exam = await examService.getById(schoolId, req.params.id);
    if (!exam) throw new HttpError(404, "Exam not found");
    await assertCanManageExamClass(schoolId, req.user!, exam.classId);
    res.json(await examService.getCompletenessSummary(schoolId, req.params.id));
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
