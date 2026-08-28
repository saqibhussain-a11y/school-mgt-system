import { prisma, runAsPlatform } from "@sms/db";
import { PLAN_DEFINITIONS, type PlanKey } from "../config/plans";

const MONTHS_BACK = 12;

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function lastNMonths(n: number) {
  const now = new Date();
  const months: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(monthKey(d));
  }
  return months;
}

export const platformReportsService = {
  getRevenue() {
    return runAsPlatform(async () => {
      const [activeGroups, pastDueGroups] = await Promise.all([
        prisma.school.groupBy({
          by: ["subscriptionPlan"],
          where: { subscriptionStatus: "active" },
          _count: { _all: true },
        }),
        prisma.school.groupBy({
          by: ["subscriptionPlan"],
          where: { subscriptionStatus: "past_due" },
          _count: { _all: true },
        }),
      ]);

      const valueOf = (plan: string, count: number) =>
        (PLAN_DEFINITIONS[plan as PlanKey]?.priceMonthly ?? 0) * count;

      const breakdown = activeGroups.map((g) => ({
        plan: g.subscriptionPlan,
        count: g._count._all,
        monthlyValue: valueOf(g.subscriptionPlan, g._count._all),
      }));

      const mrr = breakdown.reduce((sum, b) => sum + b.monthlyValue, 0);
      const atRisk = pastDueGroups.reduce((sum, g) => sum + valueOf(g.subscriptionPlan, g._count._all), 0);

      return { mrr, atRisk, breakdown };
    });
  },

  getUserCounts() {
    return runAsPlatform(async () => {
      const groups = await prisma.user.groupBy({ by: ["role"], _count: { _all: true } });
      const byRole = groups.map((g) => ({ role: g.role, count: g._count._all }));
      const total = byRole.reduce((sum, g) => sum + g.count, 0);
      return { total, byRole };
    });
  },

  getGrowthAndChurn() {
    return runAsPlatform(async () => {
      const [createdRows, churnedRows] = await Promise.all([
        prisma.$queryRaw<{ month: Date; count: bigint }[]>`
          SELECT date_trunc('month', "createdAt") AS month, COUNT(*) AS count
          FROM "School"
          WHERE "createdAt" >= now() - interval '12 months'
          GROUP BY month
        `,
        prisma.$queryRaw<{ month: Date; count: bigint }[]>`
          SELECT date_trunc('month', "createdAt") AS month, COUNT(*) AS count
          FROM "PlatformAuditLog"
          WHERE action = 'school.update_subscription'
            AND metadata -> 'to' ->> 'subscriptionStatus' = 'suspended'
            AND "createdAt" >= now() - interval '12 months'
          GROUP BY month
        `,
      ]);

      const createdByMonth = new Map(createdRows.map((r) => [monthKey(r.month), Number(r.count)]));
      const churnedByMonth = new Map(churnedRows.map((r) => [monthKey(r.month), Number(r.count)]));

      return lastNMonths(MONTHS_BACK).map((month) => ({
        month,
        created: createdByMonth.get(month) ?? 0,
        churned: churnedByMonth.get(month) ?? 0,
      }));
    });
  },

  async getAll() {
    const [revenue, userCounts, growthChurn] = await Promise.all([
      this.getRevenue(),
      this.getUserCounts(),
      this.getGrowthAndChurn(),
    ]);
    return { revenue, userCounts, growthChurn };
  },
};
