import { Router } from "express";
import multer from "multer";
import { Role } from "@sms/db";
import { assignmentService } from "../services/assignment.service";
import { studentService } from "../services/student.service";
import { studentGuardianService } from "../services/studentGuardian.service";
import { getAssignedClassIdsForUser } from "../services/teacherAssignment.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import {
  createAssignmentSchema,
  updateAssignmentSchema,
  submitAssignmentSchema,
  gradeSubmissionSchema,
} from "../validation/assignment.schema";

const ADMIN_ROLES: Role[] = [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL];
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

export const assignmentRouter = Router();
assignmentRouter.use(authenticate);

// Same class-scoping rule as exams — Subject has no teacher mapping, so a
// teacher assigned to any section of the class can manage the whole class's
// assignments (see getAssignedClassIdsForUser).
async function assertCanManageClass(schoolId: string, user: { sub: string; role: string }, classId: string) {
  if (ADMIN_ROLES.includes(user.role as Role)) return;
  if (user.role === Role.TEACHER) {
    const assignedClassIds = await getAssignedClassIdsForUser(schoolId, user.sub);
    if (assignedClassIds.includes(classId)) return;
  }
  throw new HttpError(403, "You do not have permission to manage assignments for this class");
}

// Broader viewing rule — also lets a student/parent see an assignment (and
// its attachment) if it belongs to their own/their child's class.
async function assertCanViewClass(schoolId: string, user: { sub: string; role: string }, classId: string) {
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
  throw new HttpError(403, "You do not have permission to view this assignment");
}

async function assertCanViewSubmission(
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
  throw new HttpError(403, "You do not have permission to view this submission");
}

assignmentRouter.get("/", async (req, res, next) => {
  try {
    const classId = req.query.classId as string | undefined;
    res.json(await assignmentService.list(req.user!.schoolId, classId));
  } catch (err) {
    next(err);
  }
});

assignmentRouter.get("/:id", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const assignment = await assignmentService.getById(schoolId, req.params.id);
    if (!assignment) throw new HttpError(404, "Assignment not found");
    await assertCanViewClass(schoolId, req.user!, assignment.classId);
    res.json(assignment);
  } catch (err) {
    next(err);
  }
});

assignmentRouter.post("/", validateBody(createAssignmentSchema), async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    await assertCanManageClass(schoolId, req.user!, req.body.classId);
    const assignment = await assignmentService.create(schoolId, {
      ...req.body,
      createdByUserId: req.user!.sub,
    });
    res.status(201).json(assignment);
  } catch (err) {
    next(err);
  }
});

assignmentRouter.patch("/:id", validateBody(updateAssignmentSchema), async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const existing = await assignmentService.getById(schoolId, req.params.id);
    if (!existing) throw new HttpError(404, "Assignment not found");
    await assertCanManageClass(schoolId, req.user!, existing.classId);
    res.json(await assignmentService.update(schoolId, req.params.id, req.body));
  } catch (err) {
    next(err);
  }
});

assignmentRouter.delete("/:id", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const existing = await assignmentService.getById(schoolId, req.params.id);
    if (!existing) throw new HttpError(404, "Assignment not found");
    await assertCanManageClass(schoolId, req.user!, existing.classId);
    await assignmentService.remove(schoolId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

assignmentRouter.post("/:id/attachment", upload.single("file"), async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const existing = await assignmentService.getById(schoolId, req.params.id);
    if (!existing) throw new HttpError(404, "Assignment not found");
    await assertCanManageClass(schoolId, req.user!, existing.classId);
    if (!req.file) throw new HttpError(400, "No file uploaded");
    const assignment = await assignmentService.setAttachment(schoolId, req.params.id, {
      buffer: req.file.buffer,
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });
    res.json(assignment);
  } catch (err) {
    next(err);
  }
});

assignmentRouter.get("/:id/attachment-url", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const assignment = await assignmentService.getById(schoolId, req.params.id);
    if (!assignment) throw new HttpError(404, "Assignment not found");
    await assertCanViewClass(schoolId, req.user!, assignment.classId);
    res.json({ url: await assignmentService.getAttachmentDownloadUrl(schoolId, req.params.id) });
  } catch (err) {
    next(err);
  }
});

assignmentRouter.get("/:id/submissions", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const assignment = await assignmentService.getById(schoolId, req.params.id);
    if (!assignment) throw new HttpError(404, "Assignment not found");
    await assertCanManageClass(schoolId, req.user!, assignment.classId);
    res.json(await assignmentService.listSubmissions(schoolId, req.params.id));
  } catch (err) {
    next(err);
  }
});

assignmentRouter.get("/:id/submissions/me", authorize(Role.STUDENT), async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const student = await studentService.getByUserId(schoolId, req.user!.sub);
    if (!student) throw new HttpError(404, "No student profile linked to this account");
    res.json(await assignmentService.getSubmissionForStudent(schoolId, req.params.id, student.id));
  } catch (err) {
    next(err);
  }
});

assignmentRouter.post(
  "/:id/submissions/me",
  authorize(Role.STUDENT),
  upload.single("file"),
  validateBody(submitAssignmentSchema),
  async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const student = await studentService.getByUserId(schoolId, req.user!.sub);
      if (!student) throw new HttpError(404, "No student profile linked to this account");
      const submission = await assignmentService.upsertSubmission(schoolId, req.params.id, student.id, {
        textAnswer: req.body.textAnswer,
        file: req.file
          ? { buffer: req.file.buffer, filename: req.file.originalname, contentType: req.file.mimetype }
          : undefined,
      });
      res.status(201).json(submission);
    } catch (err) {
      next(err);
    }
  },
);

assignmentRouter.get("/:id/submissions/:studentId", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const assignment = await assignmentService.getById(schoolId, req.params.id);
    if (!assignment) throw new HttpError(404, "Assignment not found");
    await assertCanViewSubmission(schoolId, req.user!, assignment.classId, req.params.studentId);
    res.json(await assignmentService.getSubmissionForStudent(schoolId, req.params.id, req.params.studentId));
  } catch (err) {
    next(err);
  }
});

assignmentRouter.get("/:id/submissions/:studentId/file-url", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const assignment = await assignmentService.getById(schoolId, req.params.id);
    if (!assignment) throw new HttpError(404, "Assignment not found");
    await assertCanViewSubmission(schoolId, req.user!, assignment.classId, req.params.studentId);
    const url = await assignmentService.getSubmissionFileDownloadUrl(schoolId, req.params.id, req.params.studentId);
    res.json({ url });
  } catch (err) {
    next(err);
  }
});

assignmentRouter.patch(
  "/:id/submissions/:studentId/grade",
  validateBody(gradeSubmissionSchema),
  async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const assignment = await assignmentService.getById(schoolId, req.params.id);
      if (!assignment) throw new HttpError(404, "Assignment not found");
      await assertCanManageClass(schoolId, req.user!, assignment.classId);
      const submission = await assignmentService.gradeSubmission(
        schoolId,
        req.params.id,
        req.params.studentId,
        req.body,
        req.user!.sub,
      );
      res.json(submission);
    } catch (err) {
      next(err);
    }
  },
);
