import { prisma, runAsPlatform } from "@sms/db";

export const platformDashboardService = {
  getStats() {
    return runAsPlatform(async () => {
      const [totalSchools, activeCount, pastDueCount, suspendedCount, recentSchools] = await Promise.all([
        prisma.school.count(),
        prisma.school.count({ where: { subscriptionStatus: "active" } }),
        prisma.school.count({ where: { subscriptionStatus: "past_due" } }),
        prisma.school.count({ where: { subscriptionStatus: "suspended" } }),
        prisma.school.findMany({
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, name: true, subdomain: true, subscriptionStatus: true, createdAt: true },
        }),
      ]);

      return { totalSchools, activeCount, pastDueCount, suspendedCount, recentSchools };
    });
  },
};
