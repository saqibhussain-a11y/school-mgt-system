import { Router } from "express";
import { Role } from "@sms/db";
import { userService } from "../services/user.service";
import { authTokenService } from "../services/authToken.service";
import { notificationService } from "../services/notification.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { HttpError } from "../middleware/errorHandler";
import { hashPassword } from "../lib/password";
import { generateTempPassword } from "../lib/tempPassword";

const ADMIN_ROLES = [Role.SCHOOL_ADMIN];

export const userRouter = Router();

userRouter.use(authenticate);

userRouter.post("/:id/reset-password", authorize(...ADMIN_ROLES), async (req, res, next) => {
  try {
    const target = await userService.getById(req.user!.schoolId, req.params.id);
    if (!target) {
      throw new HttpError(404, "User not found");
    }

    const temporaryPassword = generateTempPassword();
    await userService.updatePassword(req.user!.schoolId, target.id, await hashPassword(temporaryPassword));
    await authTokenService.revokeAllForUser(req.user!.schoolId, target.id);
    await notificationService.notifyPasswordChanged(target.email, "admin_reset");

    res.json({ temporaryPassword });
  } catch (err) {
    next(err);
  }
});
