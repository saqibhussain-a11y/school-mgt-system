import { Router } from "express";
import { Role } from "@sms/db";
import { staffService } from "../services/staff.service";
import { teacherAssignmentService } from "../services/teacherAssignment.service";
import { sectionService } from "../services/section.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { generateTempPassword } from "../lib/tempPassword";
import { createStaffSchema, updateStaffSchema, assignTeacherSchema } from "../validation/staff.schema";

const ADMIN_ROLES = [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN];
const VIEW_ROLES = [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL];

export const staffRouter = Router();

staffRouter.use(authenticate);

staffRouter.get("/", authorize(...VIEW_ROLES), async (req, res, next) => {
  try {
    res.json(await staffService.list(req.user!.schoolId));
  } catch (err) {
    next(err);
  }
});

staffRouter.get("/:id", authorize(...VIEW_ROLES), async (req, res, next) => {
  try {
    const staff = await staffService.getById(req.user!.schoolId, req.params.id);
    if (!staff) throw new HttpError(404, "Staff member not found");
    res.json(staff);
  } catch (err) {
    next(err);
  }
});

staffRouter.post(
  "/",
  authorize(...ADMIN_ROLES),
  validateBody(createStaffSchema),
  async (req, res, next) => {
    try {
      const password = req.body.password ?? generateTempPassword();
      const staff = await staffService.create(req.user!.schoolId, { ...req.body, password });
      res.status(201).json({
        ...staff,
        temporaryPassword: req.body.password ? undefined : password,
      });
    } catch (err) {
      next(err);
    }
  },
);

staffRouter.patch(
  "/:id",
  authorize(...ADMIN_ROLES),
  validateBody(updateStaffSchema),
  async (req, res, next) => {
    try {
      const staff = await staffService.update(req.user!.schoolId, req.params.id, req.body);
      if (!staff) throw new HttpError(404, "Staff member not found");
      res.json(staff);
    } catch (err) {
      next(err);
    }
  },
);

staffRouter.delete("/:id", authorize(...ADMIN_ROLES), async (req, res, next) => {
  try {
    const staff = await staffService.deactivate(req.user!.schoolId, req.params.id);
    if (!staff) throw new HttpError(404, "Staff member not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// Which class+section a teacher is assigned to teach — scopes their view of
// students and their attendance-marking to just those sections.
staffRouter.get("/:id/assignments", authorize(...ADMIN_ROLES), async (req, res, next) => {
  try {
    res.json(await teacherAssignmentService.listForStaff(req.user!.schoolId, req.params.id));
  } catch (err) {
    next(err);
  }
});

staffRouter.post(
  "/:id/assignments",
  authorize(...ADMIN_ROLES),
  validateBody(assignTeacherSchema),
  async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const { classId, sectionId } = req.body;
      const section = await sectionService.getById(schoolId, sectionId);
      if (!section || section.classId !== classId) {
        throw new HttpError(400, "Section not found in that class");
      }
      const assignment = await teacherAssignmentService.create(
        schoolId,
        req.params.id,
        classId,
        sectionId,
      );
      res.status(201).json(assignment);
    } catch (err) {
      next(err);
    }
  },
);

staffRouter.delete(
  "/:id/assignments/:sectionId",
  authorize(...ADMIN_ROLES),
  async (req, res, next) => {
    try {
      const removed = await teacherAssignmentService.remove(
        req.user!.schoolId,
        req.params.id,
        req.params.sectionId,
      );
      if (!removed) throw new HttpError(404, "Assignment not found");
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);
