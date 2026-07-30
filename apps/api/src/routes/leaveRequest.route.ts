import { Router } from "express";
import { Role, LeaveStatus } from "@sms/db";
import { leaveRequestService } from "../services/leaveRequest.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { createLeaveRequestSchema, reviewLeaveRequestSchema } from "../validation/leaveRequest.schema";

// Students and every non-admin staff role can apply for their own leave.
// SCHOOL_ADMIN/SUPER_ADMIN don't — they're the reviewers here, not applicants.
const APPLICANT_ROLES: Role[] = [
  Role.PRINCIPAL,
  Role.TEACHER,
  Role.ACCOUNTANT,
  Role.LIBRARIAN,
  Role.TRANSPORT_MANAGER,
  Role.STUDENT,
];
const VIEW_ALL_ROLES: Role[] = [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL];
// SUPER_ADMIN keeps view-only oversight, same pattern as staff/student/guardian —
// only SCHOOL_ADMIN and PRINCIPAL can actually approve/reject.
const REVIEW_ROLES: Role[] = [Role.SCHOOL_ADMIN, Role.PRINCIPAL];

export const leaveRequestRouter = Router();

leaveRequestRouter.use(authenticate);

leaveRequestRouter.get("/me", async (req, res, next) => {
  try {
    res.json(await leaveRequestService.listForUser(req.user!.schoolId, req.user!.sub));
  } catch (err) {
    next(err);
  }
});

leaveRequestRouter.get("/balance", async (req, res, next) => {
  try {
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    res.json(await leaveRequestService.getStaffBalance(req.user!.schoolId, req.user!.sub, year));
  } catch (err) {
    next(err);
  }
});

leaveRequestRouter.get("/", authorize(...VIEW_ALL_ROLES), async (req, res, next) => {
  try {
    const { status, role } = req.query as { status?: LeaveStatus; role?: Role };
    res.json(await leaveRequestService.listForSchool(req.user!.schoolId, { status, role }));
  } catch (err) {
    next(err);
  }
});

leaveRequestRouter.post(
  "/",
  authorize(...APPLICANT_ROLES),
  validateBody(createLeaveRequestSchema),
  async (req, res, next) => {
    try {
      const request = await leaveRequestService.create(
        req.user!.schoolId,
        req.user!.sub,
        req.user!.role as Role,
        req.body,
      );
      res.status(201).json(request);
    } catch (err) {
      next(err);
    }
  },
);

leaveRequestRouter.patch("/:id/cancel", async (req, res, next) => {
  try {
    const request = await leaveRequestService.cancel(
      req.user!.schoolId,
      req.params.id,
      req.user!.sub,
    );
    if (!request) throw new HttpError(404, "Leave request not found");
    res.json(request);
  } catch (err) {
    next(err);
  }
});

leaveRequestRouter.patch(
  "/:id/review",
  authorize(...REVIEW_ROLES),
  validateBody(reviewLeaveRequestSchema),
  async (req, res, next) => {
    try {
      const request = await leaveRequestService.review(
        req.user!.schoolId,
        req.params.id,
        req.user!.sub,
        req.body.status,
        req.body.reviewNote,
      );
      if (!request) throw new HttpError(404, "Leave request not found");
      res.json(request);
    } catch (err) {
      next(err);
    }
  },
);
