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
  // school.service.ts and auth.service.ts's impersonation path.
  record(tx: PrismaTransactionClient, entry: AuditLogEntry) {
    return tx.platformAuditLog.create({ data: entry });
  },

  // For actions with no primary DB write of their own to piggyback a
  // transaction on (e.g. impersonation — minting a JWT touches no table).
  recordStandalone(platformAdminId: string, entry: Omit<AuditLogEntry, "platformAdminId">) {
    return runAsPlatform(() => prisma.platformAuditLog.create({ data: { platformAdminId, ...entry } }));
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
