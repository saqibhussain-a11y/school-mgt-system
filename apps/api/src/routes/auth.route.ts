import { Router } from "express";
import { authService } from "../services/auth.service";
import { authenticate } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { loginLimiter, passwordResetRequestLimiter, otpVerifyLimiter } from "../middleware/rateLimit";
import {
  loginSchema,
  platformLoginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "../validation/auth.schema";

export const authRouter = Router();

authRouter.post("/login", loginLimiter, validateBody(loginSchema), async (req, res, next) => {
  try {
    const { schoolId, email, password } = req.body;
    const tokens = await authService.login(schoolId, email, password);
    res.json(tokens);
  } catch (err) {
    next(err);
  }
});

authRouter.post(
  "/platform-login",
  loginLimiter,
  validateBody(platformLoginSchema),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const tokens = await authService.platformLogin(email, password);
      res.json(tokens);
    } catch (err) {
      next(err);
    }
  },
);

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

authRouter.post("/platform-refresh", validateBody(refreshSchema), async (req, res, next) => {
  try {
    const tokens = await authService.platformRefresh(req.body.refreshToken);
    res.json(tokens);
  } catch (err) {
    next(err);
  }
});

authRouter.post("/platform-logout", validateBody(refreshSchema), async (req, res, next) => {
  try {
    await authService.platformLogout(req.body.refreshToken);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

authRouter.post(
  "/forgot-password",
  passwordResetRequestLimiter,
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

authRouter.post("/reset-password", otpVerifyLimiter, validateBody(resetPasswordSchema), async (req, res, next) => {
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
      await authService.changePassword(req.user!.schoolId, req.user!.sub, currentPassword, newPassword);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);
