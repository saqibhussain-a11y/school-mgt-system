import { prisma, runAsPlatform } from "@sms/db";
import { sha256 } from "../lib/hash";
import { REFRESH_TOKEN_TTL_MS } from "../lib/jwt";

export const platformAuthTokenService = {
  store(platformAdminId: string, rawToken: string) {
    return runAsPlatform(() =>
      prisma.platformRefreshToken.create({
        data: {
          platformAdminId,
          tokenHash: sha256(rawToken),
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        },
      }),
    );
  },

  findActiveByRawToken(rawToken: string) {
    return runAsPlatform(() =>
      prisma.platformRefreshToken.findFirst({
        where: {
          tokenHash: sha256(rawToken),
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      }),
    );
  },

  revoke(id: string) {
    return runAsPlatform(() =>
      prisma.platformRefreshToken.updateMany({
        where: { id },
        data: { revokedAt: new Date() },
      }),
    );
  },

  revokeAllForAdmin(platformAdminId: string) {
    return runAsPlatform(() =>
      prisma.platformRefreshToken.updateMany({
        where: { platformAdminId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    );
  },
};
