import { prisma } from "@sms/db";

export interface LeavePolicyUpdate {
  sickDays?: number;
  casualDays?: number;
  otherDays?: number;
}

export const leavePolicyService = {
  // Lazily upserted with schema defaults on first access — no backfill
  // migration needed for schools that existed before this model did.
  getOrCreate(schoolId: string) {
    return prisma.leavePolicy.upsert({
      where: { schoolId },
      create: { schoolId },
      update: {},
    });
  },

  update(schoolId: string, data: LeavePolicyUpdate) {
    return prisma.leavePolicy.upsert({
      where: { schoolId },
      create: { schoolId, ...data },
      update: data,
    });
  },
};
