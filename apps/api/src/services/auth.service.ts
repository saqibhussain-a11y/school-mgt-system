import { Role } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";
import { hashPassword, verifyPassword } from "../lib/password";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  signPlatformAccessToken,
  signPlatformRefreshToken,
  verifyPlatformRefreshToken,
} from "../lib/jwt";
import { generateOtp } from "../lib/otp";
import { userService } from "./user.service";
import { authTokenService } from "./authToken.service";
import { platformAdminService } from "./platformAdmin.service";
import { platformAuthTokenService } from "./platformAuthToken.service";
import { passwordResetService } from "./passwordReset.service";
import { notificationService } from "./notification.service";

async function issueTokenPair(user: { id: string; schoolId: string; role: Role }) {
  const accessToken = signAccessToken({ sub: user.id, schoolId: user.schoolId, role: user.role });
  const { token: refreshToken } = signRefreshToken({ sub: user.id, schoolId: user.schoolId });
  await authTokenService.store(user.schoolId, user.id, refreshToken);
  return { accessToken, refreshToken };
}

async function issuePlatformTokenPair(admin: { id: string }) {
  const accessToken = signPlatformAccessToken({ sub: admin.id });
  const { token: refreshToken } = signPlatformRefreshToken({ sub: admin.id });
  await platformAuthTokenService.store(admin.id, refreshToken);
  return { accessToken, refreshToken };
}

export const authService = {
  async login(schoolId: string, email: string, password: string) {
    const user = await userService.findByEmail(schoolId, email);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new HttpError(401, "Invalid email or password");
    }
    if (!user.isActivated) {
      throw new HttpError(403, "This account hasn't been activated yet — ask your school to issue your login credentials.");
    }
    return issueTokenPair(user);
  },

  async platformLogin(email: string, password: string) {
    const admin = await platformAdminService.findByEmail(email);
    if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
      throw new HttpError(401, "Invalid email or password");
    }
    return issuePlatformTokenPair(admin);
  },

  async platformRefresh(rawToken: string) {
    let payload;
    try {
      payload = verifyPlatformRefreshToken(rawToken);
    } catch {
      throw new HttpError(401, "Invalid or expired refresh token");
    }

    const stored = await platformAuthTokenService.findActiveByRawToken(rawToken);
    if (!stored) {
      throw new HttpError(401, "Refresh token has been revoked or reused");
    }

    const admin = await platformAdminService.getById(payload.sub);
    if (!admin) {
      throw new HttpError(401, "Platform admin no longer exists");
    }

    await platformAuthTokenService.revoke(stored.id);
    return issuePlatformTokenPair(admin);
  },

  async platformLogout(rawToken: string) {
    const stored = await platformAuthTokenService.findActiveByRawToken(rawToken);
    if (stored) {
      await platformAuthTokenService.revoke(stored.id);
    }
  },

  async refresh(rawToken: string) {
    let payload;
    try {
      payload = verifyRefreshToken(rawToken);
    } catch {
      throw new HttpError(401, "Invalid or expired refresh token");
    }

    const stored = await authTokenService.findActiveByRawToken(rawToken);
    if (!stored) {
      throw new HttpError(401, "Refresh token has been revoked or reused");
    }

    const user = await userService.getById(payload.schoolId, payload.sub);
    if (!user) {
      throw new HttpError(401, "User no longer exists");
    }

    await authTokenService.revoke(stored.schoolId, stored.id);
    return issueTokenPair(user);
  },

  async logout(rawToken: string) {
    const stored = await authTokenService.findActiveByRawToken(rawToken);
    if (stored) {
      await authTokenService.revoke(stored.schoolId, stored.id);
    }
  },

  async requestPasswordReset(schoolId: string, email: string) {
    const user = await userService.findByEmail(schoolId, email);
    if (!user || !user.isActivated) {
      return;
    }
    const otp = generateOtp();
    await passwordResetService.create(schoolId, user.id, otp);
    await notificationService.notifyPasswordResetOtp(email, otp);
  },

  async resetPassword(schoolId: string, email: string, otp: string, newPassword: string) {
    const user = await userService.findByEmail(schoolId, email);
    if (!user) {
      throw new HttpError(400, "Invalid OTP");
    }
    const record = await passwordResetService.findValid(schoolId, user.id, otp);
    if (!record) {
      throw new HttpError(400, "Invalid or expired OTP");
    }
    await passwordResetService.consume(schoolId, record.id);
    const passwordHash = await hashPassword(newPassword);
    await userService.updatePassword(schoolId, user.id, passwordHash);
    await authTokenService.revokeAllForUser(schoolId, user.id);
    await notificationService.notifyPasswordChanged(email, "otp_reset");
  },

  async changePassword(schoolId: string, userId: string, currentPassword: string, newPassword: string) {
    const user = await userService.getById(schoolId, userId);
    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new HttpError(401, "Current password is incorrect");
    }
    const passwordHash = await hashPassword(newPassword);
    await userService.updatePassword(schoolId, user.id, passwordHash);
    await authTokenService.revokeAllForUser(schoolId, user.id);
  },
};
