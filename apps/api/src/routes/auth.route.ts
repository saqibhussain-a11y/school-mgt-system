import { Router } from "express";
import { Role } from "@sms/db";
import { authService } from "../services/auth.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import {
  loginSchema,
  refreshSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
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
  authorize(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN),
  validateBody(registerSchema),
  async (req, res, next) => {
    try {
      const { schoolId, email, password, role } = req.body;
      const user = await authService.register(schoolId, email, password, role);
      res.status(201).json({ id: user.id, email: user.email, role: user.role });
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
