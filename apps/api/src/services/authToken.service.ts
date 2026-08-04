import { prisma } from "@sms/db";
import { sha256 } from "../lib/hash";
import { REFRESH_TOKEN_TTL_MS } from "../lib/jwt";

export const authTokenService = {
  store(schoolId: string, userId: string, rawToken: string) {
    return prisma.refreshToken.create({
      data: {
        schoolId,
        userId,
        tokenHash: sha256(rawToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });
  },

  findActiveByRawToken(rawToken: string) {
    return prisma.refreshToken.findFirst({
      where: {
        tokenHash: sha256(rawToken),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  },

  revoke(schoolId: string, id: string) {
    return prisma.refreshToken.updateMany({
      where: { id, schoolId },
      data: { revokedAt: new Date() },
    });
  },

  revokeAllForUser(schoolId: string, userId: string) {
    return prisma.refreshToken.updateMany({
      where: { userId, schoolId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};
