import { prisma } from "@sms/db";
import { hashPassword, verifyPassword } from "../lib/password";
import { OTP_TTL_MS } from "../lib/otp";

export const passwordResetService = {
  async create(schoolId: string, userId: string, otp: string) {
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

  async findValid(userId: string, otp: string) {
    const candidates = await prisma.passwordResetOtp.findMany({
      where: { userId, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });

    for (const candidate of candidates) {
      if (await verifyPassword(otp, candidate.otpHash)) {
        return candidate;
      }
    }
    return null;
  },

  consume(id: string) {
    return prisma.passwordResetOtp.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  },
};
