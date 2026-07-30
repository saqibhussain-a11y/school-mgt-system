import { Router } from "express";
import { Role } from "@sms/db";
import { authService } from "../services/auth.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { generateTempPassword } from "../lib/tempPassword";
import {
  loginSchema,
  refreshSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "../validation/auth.schema";

export const authRouter = Router();

authRouter.post("/login", validateBody(loginSchema), async (req, res, next) => {
  try {
    const { schoolId, email, password } = req.body;
    const tokens = await authService.login(schoolId, email, password);
    res.json(tokens);
  } catch (err) {
    next(err);
  }
});

authRouter.post("/refresh", validateBody(refreshSchema), async (req, res, next) => {
  try {
    const tokens = await authService.refresh(req.body.refreshToken);
    res.json(tokens);
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", validateBody(refreshSchema), async (req, res, next) => {
  try {
    await authService.logout(req.body.refreshToken);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

authRouter.post(
  "/register",
  authenticate,
  authorize(Role.SUPER_ADMIN),
  validateBody(registerSchema),
  async (req, res, next) => {
    try {
      const { email, role, firstName, lastName } = req.body;
      const password = req.body.password ?? generateTempPassword();
      const user = await authService.register(
        req.user!.schoolId,
        email,
        password,
        role,
        firstName,
        lastName,
      );
      res.status(201).json({
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        temporaryPassword: req.body.password ? undefined : password,
      });
    } catch (err) {
      next(err);
    }
  },
);

authRouter.post(
  "/forgot-password",
  validateBody(forgotPasswordSchema),
  async (req, res, next) => {
    try {
      const { schoolId, email } = req.body;
      await authService.requestPasswordReset(schoolId, email);
      res.status(202).json({ message: "If that account exists, a reset code has been sent" });
    } catch (err) {
      next(err);
    }
  },
);

authRouter.post("/reset-password", validateBody(resetPasswordSchema), async (req, res, next) => {
  try {
    const { schoolId, email, otp, newPassword } = req.body;
    await authService.resetPassword(schoolId, email, otp, newPassword);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

authRouter.post(
  "/change-password",
  authenticate,
  validateBody(changePasswordSchema),
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;
      await authService.changePassword(req.user!.sub, currentPassword, newPassword);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);
