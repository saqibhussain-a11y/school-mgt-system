import { prisma } from "@sms/db";
import { hashPassword, verifyPassword } from "../lib/password";
import { OTP_TTL_MS, MAX_OTP_ATTEMPTS } from "../lib/otp";

export const passwordResetService = {
  async create(schoolId: string, userId: string, otp: string) {
    // A fresh OTP invalidates any still-active one for this user — otherwise
    // an attacker who captured (or brute-forced partway through) an earlier
    // OTP could keep trying it after the user requested a new one.
    await prisma.passwordResetOtp.updateMany({
      where: { schoolId, userId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    const otpHash = await hashPassword(otp);
    return prisma.passwordResetOtp.create({
      data: {
        schoolId,
        userId,
        otpHash,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });
  },

  async findValid(schoolId: string, userId: string, otp: string) {
    const candidates = await prisma.passwordResetOtp.findMany({
      where: { schoolId, userId, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });

    for (const candidate of candidates) {
      // A per-account attempt cap independent of the IP-based rate limiter on
      // the route — that one resets if an attacker rotates IPs, this doesn't.
      if (candidate.attempts >= MAX_OTP_ATTEMPTS) continue;
      if (await verifyPassword(otp, candidate.otpHash)) {
        return candidate;
      }
      await prisma.passwordResetOtp.update({
        where: { id: candidate.id },
        data: { attempts: { increment: 1 } },
      });
    }
    return null;
  },

  consume(schoolId: string, id: string) {
    return prisma.passwordResetOtp.updateMany({
      where: { id, schoolId },
      data: { consumedAt: new Date() },
    });
  },
};
