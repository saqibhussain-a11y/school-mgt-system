import { prisma, runAsPlatform, type PrismaTransactionClient } from "@sms/db";
import type { Prisma } from "@sms/db";

export interface AuditLogEntry {
  platformAdminId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Prisma.InputJsonValue;
}

export const platformAuditLogService = {
  // Takes the transaction client of whatever mutation it's logging, so the
  // audit row and the action it describes can never desync — see callers in
  // school.service.ts.
  record(tx: PrismaTransactionClient, entry: AuditLogEntry) {
    return tx.platformAuditLog.create({ data: entry });
  },

  list(limit = 50, cursor?: string) {
    return runAsPlatform(() =>
      prisma.platformAuditLog.findMany({
        take: limit,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { createdAt: "desc" },
        include: { platformAdmin: { select: { email: true, firstName: true, lastName: true } } },
      }),
    );
  },
};
