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

  async findValid(schoolId: string, userId: string, otp: string) {
    const candidates = await prisma.passwordResetOtp.findMany({
      where: { schoolId, userId, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });

    for (const candidate of candidates) {
      if (await verifyPassword(otp, candidate.otpHash)) {
        return candidate;
      }
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
