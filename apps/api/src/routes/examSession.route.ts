import { Router } from "express";
import { Role } from "@sms/db";
import { examSessionService } from "../services/examSession.service";
import { examSeatingService } from "../services/examSeating.service";
import { examInvigilationService } from "../services/examInvigilation.service";
import { getAssignedClassIdsForUser } from "../services/teacherAssignment.service";
import { studentService } from "../services/student.service";
import { studentGuardianService } from "../services/studentGuardian.service";
import { buildAdmitCardsPdf } from "../lib/examAdmitCardPdf";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { createExamSessionSchema, updateExamSessionSchema } from "../validation/examSession.schema";
import { generateSeatingSchema, assignSeatSchema } from "../validation/examSeating.schema";
import { generateInvigilationSchema, assignInvigilationSchema } from "../validation/examInvigilation.schema";

const ADMIN_ROLES: Role[] = [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL];

export const examSessionRouter = Router();

// A teacher assigned to only ONE class in a multi-class session must still
// see the WHOLE room's seat chart — showing "your class's seats" without
// who's sitting adjacent defeats the entire point of cross-class seating.
// Deliberately broader than the usual per-class scoping; don't narrow this.
export async function assertCanViewExamSession(
  schoolId: string,
  user: { sub: string; role: string },
  examSessionId: string,
) {
  if (ADMIN_ROLES.includes(user.role as Role)) return;
  if (user.role === Role.TEACHER) {
    const [assignedClassIds, session] = await Promise.all([
      getAssignedClassIdsForUser(schoolId, user.sub),
      examSessionService.getById(schoolId, examSessionId),
    ]);
    if (session && session.exams.some((e) => assignedClassIds.includes(e.classId))) return;
  }
  throw new HttpError(403, "You do not have permission to view this exam session");
}

examSessionRouter.use(authenticate);

examSessionRouter.get("/", async (req, res, next) => {
  try {
    res.json(await examSessionService.list(req.user!.schoolId));
  } catch (err) {
    next(err);
  }
});

examSessionRouter.get("/:id", async (req, res, next) => {
  try {
    const session = await examSessionService.getById(req.user!.schoolId, req.params.id);
    if (!session) throw new HttpError(404, "Exam session not found");
    res.json(session);
  } catch (err) {
    next(err);
  }
});

examSessionRouter.post(
  "/",
  authorize(...ADMIN_ROLES),
  validateBody(createExamSessionSchema),
  async (req, res, next) => {
    try {
      res.status(201).json(await examSessionService.create(req.user!.schoolId, req.body));
    } catch (err) {
      next(err);
    }
  },
);

examSessionRouter.patch(
  "/:id",
  authorize(...ADMIN_ROLES),
  validateBody(updateExamSessionSchema),
  async (req, res, next) => {
    try {
      const session = await examSessionService.update(req.user!.schoolId, req.params.id, req.body);
      if (!session) throw new HttpError(404, "Exam session not found");
      res.json(session);
    } catch (err) {
      next(err);
    }
  },
);

examSessionRouter.delete("/:id", authorize(...ADMIN_ROLES), async (req, res, next) => {
  try {
    const session = await examSessionService.remove(req.user!.schoolId, req.params.id);
    if (!session) throw new HttpError(404, "Exam session not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

examSessionRouter.post(
  "/:id/seating/generate",
  authorize(...ADMIN_ROLES),
  validateBody(generateSeatingSchema),
  async (req, res, next) => {
    try {
      const result = await examSeatingService.generate(req.user!.schoolId, {
        examSessionId: req.params.id,
        roomIds: req.body.roomIds,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

examSessionRouter.get("/:id/seating", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    await assertCanViewExamSession(schoolId, req.user!, req.params.id);
    res.json(await examSeatingService.listForSession(schoolId, req.params.id));
  } catch (err) {
    next(err);
  }
});

examSessionRouter.patch(
  "/:id/seating/:studentId",
  authorize(...ADMIN_ROLES),
  validateBody(assignSeatSchema),
  async (req, res, next) => {
    try {
      const allocation = await examSeatingService.assignSeat(
        req.user!.schoolId,
        req.params.id,
        req.params.studentId,
        req.body,
      );
      res.json(allocation);
    } catch (err) {
      next(err);
    }
  },
);

examSessionRouter.delete(
  "/:id/seating/:studentId",
  authorize(...ADMIN_ROLES),
  async (req, res, next) => {
    try {
      const removed = await examSeatingService.unassignSeat(
        req.user!.schoolId,
        req.params.id,
        req.params.studentId,
      );
      if (!removed) throw new HttpError(404, "Seat allocation not found");
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

examSessionRouter.post(
  "/:id/invigilation/generate",
  authorize(...ADMIN_ROLES),
  validateBody(generateInvigilationSchema),
  async (req, res, next) => {
    try {
      const result = await examInvigilationService.generate(req.user!.schoolId, req.params.id, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

examSessionRouter.get("/:id/invigilation", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    await assertCanViewExamSession(schoolId, req.user!, req.params.id);
    res.json(await examInvigilationService.listForSession(schoolId, req.params.id));
  } catch (err) {
    next(err);
  }
});

examSessionRouter.post(
  "/:id/invigilation",
  authorize(...ADMIN_ROLES),
  validateBody(assignInvigilationSchema),
  async (req, res, next) => {
    try {
      const duty = await examInvigilationService.assign(req.user!.schoolId, req.params.id, req.body);
      res.status(201).json(duty);
    } catch (err) {
      next(err);
    }
  },
);

examSessionRouter.delete(
  "/:id/invigilation/:invigilationId",
  authorize(...ADMIN_ROLES),
  async (req, res, next) => {
    try {
      const removed = await examInvigilationService.remove(req.user!.schoolId, req.params.invigilationId);
      if (!removed) throw new HttpError(404, "Invigilation duty not found");
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

// Bulk, whole/partial-session admit cards. Admins get the full roster; a
// teacher may call this too, but the class scope is always narrowed
// server-side to their own assigned classes within the session — never
// trusting a client-supplied classId for a document that can embed other
// classes' seat/room data.
examSessionRouter.get("/:id/admit-cards", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const user = req.user!;
    let classIds: string[] | undefined;

    if (!ADMIN_ROLES.includes(user.role as Role)) {
      if (user.role !== Role.TEACHER) {
        throw new HttpError(403, "You do not have permission to generate admit cards for this session");
      }
      const [assignedClassIds, session] = await Promise.all([
        getAssignedClassIdsForUser(schoolId, user.sub),
        examSessionService.getById(schoolId, req.params.id),
      ]);
      if (!session) throw new HttpError(404, "Exam session not found");
      const sessionClassIds = session.exams.map((e) => e.classId);
      classIds = sessionClassIds.filter((id) => assignedClassIds.includes(id));
      if (classIds.length === 0) {
        throw new HttpError(403, "You are not assigned to any class in this exam session");
      }
    }

    const pdf = await buildAdmitCardsPdf(schoolId, { examSessionId: req.params.id, classIds });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="admit-cards.pdf"');
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

examSessionRouter.get("/:id/students/:studentId/admit-card", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const user = req.user!;
    const studentId = req.params.studentId;

    if (!ADMIN_ROLES.includes(user.role as Role)) {
      let allowed = false;
      if (user.role === Role.TEACHER) {
        const student = await studentService.getById(schoolId, studentId);
        if (student) {
          const assignedClassIds = await getAssignedClassIdsForUser(schoolId, user.sub);
          allowed = assignedClassIds.includes(student.classId);
        }
      } else if (user.role === Role.STUDENT) {
        allowed = await studentService.isOwnStudent(schoolId, user.sub, studentId);
      } else if (user.role === Role.PARENT) {
        allowed = await studentGuardianService.isGuardianOfStudent(schoolId, user.sub, studentId);
      }
      if (!allowed) throw new HttpError(403, "You do not have permission to view this admit card");
    }

    const pdf = await buildAdmitCardsPdf(schoolId, { examSessionId: req.params.id, studentId });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="admit-card.pdf"');
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});
