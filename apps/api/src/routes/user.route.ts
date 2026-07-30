import { Router } from "express";
import { Role } from "@sms/db";
import { userService } from "../services/user.service";
import { authTokenService } from "../services/authToken.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { HttpError } from "../middleware/errorHandler";
import { hashPassword } from "../lib/password";
import { generateTempPassword } from "../lib/tempPassword";

const ADMIN_ROLES = [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN];

export const userRouter = Router();

userRouter.use(authenticate);

// SUPER_ADMIN's own management list — the only account type they create now.
userRouter.get("/school-admins", authorize(Role.SUPER_ADMIN), async (req, res, next) => {
  try {
    res.json(await userService.listByRole(req.user!.schoolId, Role.SCHOOL_ADMIN));
  } catch (err) {
    next(err);
  }
});

// Lets an admin issue a fresh temporary password for any user in their school
// without needing that user's old password — the OTP/email flow isn't usable
// for this since no email provider is wired up yet.
userRouter.post("/:id/reset-password", authorize(...ADMIN_ROLES), async (req, res, next) => {
  try {
    const target = await userService.findById(req.params.id);
    if (!target || target.schoolId !== req.user!.schoolId) {
      throw new HttpError(404, "User not found");
    }

    const temporaryPassword = generateTempPassword();
    await userService.updatePassword(target.id, await hashPassword(temporaryPassword));
    await authTokenService.revokeAllForUser(target.id);

    res.json({ temporaryPassword });
  } catch (err) {
    next(err);
  }
});
