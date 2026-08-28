import { prisma, runAsPlatform } from "@sms/db";

const TRIAL_ENDING_SOON_DAYS = 3;
const PAST_DUE_STALE_DAYS = 14;

export const platformDashboardService = {
  getStats() {
    return runAsPlatform(async () => {
      const [totalSchools, activeCount, pastDueCount, suspendedCount, recentSchools, needsAttention] =
        await Promise.all([
          prisma.school.count(),
          prisma.school.count({ where: { subscriptionStatus: "active" } }),
          prisma.school.count({ where: { subscriptionStatus: "past_due" } }),
          prisma.school.count({ where: { subscriptionStatus: "suspended" } }),
          prisma.school.findMany({
            orderBy: { createdAt: "desc" },
            take: 5,
            select: { id: true, name: true, subdomain: true, subscriptionStatus: true, createdAt: true },
          }),
          this.getNeedsAttention(),
        ]);

      return { totalSchools, activeCount, pastDueCount, suspendedCount, recentSchools, needsAttention };
    });
  },

  // Computed on read, not a scheduled job — cheap enough to run every
  // dashboard load, and avoids standing up cron/queue infra for something
  // that's really just two date comparisons over a handful of schools.
  getNeedsAttention() {
    return runAsPlatform(async () => {
      const now = new Date();
      const trialCutoff = new Date(now.getTime() + TRIAL_ENDING_SOON_DAYS * 24 * 60 * 60 * 1000);
      const pastDueCutoff = new Date(now.getTime() - PAST_DUE_STALE_DAYS * 24 * 60 * 60 * 1000);

      const [trialsEnding, stalePastDue] = await Promise.all([
        prisma.school.findMany({
          where: {
            trialEndsAt: { not: null, lte: trialCutoff, gte: now },
            subscriptionStatus: { not: "suspended" },
          },
          select: { id: true, name: true, trialEndsAt: true },
        }),
        prisma.school.findMany({
          where: {
            subscriptionStatus: "past_due",
            subscriptionStatusChangedAt: { lte: pastDueCutoff },
          },
          select: { id: true, name: true, subscriptionStatusChangedAt: true },
        }),
      ]);

      return [
        ...trialsEnding.map((s) => ({
          schoolId: s.id,
          schoolName: s.name,
          reason: "trial_ending" as const,
          detail: s.trialEndsAt,
        })),
        ...stalePastDue.map((s) => ({
          schoolId: s.id,
          schoolName: s.name,
          reason: "past_due_stale" as const,
          detail: s.subscriptionStatusChangedAt,
        })),
      ];
    });
  },
};
