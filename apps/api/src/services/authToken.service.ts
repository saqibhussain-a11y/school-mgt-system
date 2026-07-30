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

  revoke(id: string) {
    return prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  },

  revokeAllForUser(userId: string) {
    return prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};
