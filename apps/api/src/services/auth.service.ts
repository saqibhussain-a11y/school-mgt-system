import { Role } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";
import { hashPassword, verifyPassword } from "../lib/password";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../lib/jwt";
import { generateOtp } from "../lib/otp";
import { userService } from "./user.service";
import { authTokenService } from "./authToken.service";
import { passwordResetService } from "./passwordReset.service";
import { notificationService } from "./notification.service";

async function issueTokenPair(user: { id: string; schoolId: string; role: Role }) {
  const accessToken = signAccessToken({ sub: user.id, schoolId: user.schoolId, role: user.role });
  const { token: refreshToken } = signRefreshToken({ sub: user.id, schoolId: user.schoolId });
  await authTokenService.store(user.schoolId, user.id, refreshToken);
  return { accessToken, refreshToken };
}

export const authService = {
  async login(schoolId: string, email: string, password: string) {
    const user = await userService.findByEmail(schoolId, email);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new HttpError(401, "Invalid email or password");
    }
    return issueTokenPair(user);
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

    const user = await userService.findById(payload.sub);
    if (!user) {
      throw new HttpError(401, "User no longer exists");
    }

    await authTokenService.revoke(stored.id);
    return issueTokenPair(user);
  },

  async logout(rawToken: string) {
    const stored = await authTokenService.findActiveByRawToken(rawToken);
    if (stored) {
      await authTokenService.revoke(stored.id);
    }
  },

  async register(
    schoolId: string,
    email: string,
    password: string,
    role: Role,
    firstName: string,
    lastName: string,
  ) {
    const existing = await userService.findByEmail(schoolId, email);
    if (existing) {
      throw new HttpError(409, "A user with this email already exists");
    }
    const passwordHash = await hashPassword(password);
    return userService.create({ schoolId, email, passwordHash, role, firstName, lastName });
  },

  async requestPasswordReset(schoolId: string, email: string) {
    const user = await userService.findByEmail(schoolId, email);
    if (!user) {
      // Do not reveal whether the email exists.
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
    const record = await passwordResetService.findValid(user.id, otp);
    if (!record) {
      throw new HttpError(400, "Invalid or expired OTP");
    }
    await passwordResetService.consume(record.id);
    const passwordHash = await hashPassword(newPassword);
    await userService.updatePassword(user.id, passwordHash);
    await authTokenService.revokeAllForUser(user.id);
    await notificationService.notifyPasswordChanged(email, "otp_reset");
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await userService.findById(userId);
    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new HttpError(401, "Current password is incorrect");
    }
    const passwordHash = await hashPassword(newPassword);
    await userService.updatePassword(user.id, passwordHash);
    await authTokenService.revokeAllForUser(user.id);
  },
};
