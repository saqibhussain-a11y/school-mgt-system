import { Router } from "express";
import { Role } from "@sms/db";
import { leavePolicyService } from "../services/leavePolicy.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { updateLeavePolicySchema } from "../validation/leavePolicy.schema";

// Same set as REVIEW_ROLES in leaveRequest.route.ts — the reviewers are also
// the only ones who can set the entitlement they review against.
const POLICY_ADMIN_ROLES: Role[] = [Role.SCHOOL_ADMIN, Role.PRINCIPAL];

export const leavePolicyRouter = Router();

leavePolicyRouter.use(authenticate);

leavePolicyRouter.get("/", async (req, res, next) => {
  try {
    res.json(await leavePolicyService.getOrCreate(req.user!.schoolId));
  } catch (err) {
    next(err);
  }
});

leavePolicyRouter.patch(
  "/",
  authorize(...POLICY_ADMIN_ROLES),
  validateBody(updateLeavePolicySchema),
  async (req, res, next) => {
    try {
      res.json(await leavePolicyService.update(req.user!.schoolId, req.body));
    } catch (err) {
      next(err);
    }
  },
);
