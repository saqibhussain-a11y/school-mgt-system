"use client";

import { DollarSign, TriangleAlert, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GrowthChurnChart, UsersByRoleChart } from "@/components/platform/lazy-charts";
import { PLAN_LABELS, type PlanKey } from "@/components/platform/types";
import { usePlatformApi } from "@/lib/use-platform-api";
import { formatCurrency } from "@/lib/format";

interface PlanBreakdownRow {
  plan: string;
  count: number;
  monthlyValue: number;
}

interface RoleCount {
  role: string;
  count: number;
}

interface PlatformReports {
  revenue: { mrr: number; atRisk: number; breakdown: PlanBreakdownRow[] };
  userCounts: { total: number; byRole: RoleCount[] };
  growthChurn: { month: string; created: number; churned: number }[];
}

export default function PlatformReportsPage() {
  const { data, loading } = usePlatformApi<PlatformReports>("/api/platform/reports");

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Revenue, users, and growth across every school on the platform"
      />

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="MRR"
            value={loading || !data ? "—" : formatCurrency(data.revenue.mrr)}
            icon={DollarSign}
            tone="good"
            hint="Active schools only"
          />
          <StatCard
            label="At-risk revenue"
            value={loading || !data ? "—" : formatCurrency(data.revenue.atRisk)}
            icon={TriangleAlert}
            tone="warning"
            hint="Past-due schools"
          />
          <StatCard
            label="Total users"
            value={loading || !data ? "—" : data.userCounts.total}
            icon={Users}
            tone="primary"
            hint="Across every school"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue by plan</CardTitle>
          </CardHeader>
          <CardContent>
            {loading || !data || data.revenue.breakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active schools yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan</TableHead>
                    <TableHead>Active schools</TableHead>
                    <TableHead>Monthly value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.revenue.breakdown.map((row) => (
                    <TableRow key={row.plan}>
                      <TableCell className="font-medium">
                        {PLAN_LABELS[row.plan as PlanKey] ?? row.plan}
                      </TableCell>
                      <TableCell>{row.count}</TableCell>
                      <TableCell>{formatCurrency(row.monthlyValue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">
            Schools added vs. suspended, last 12 months
          </h2>
          <GrowthChurnChart data={data?.growthChurn ?? null} loading={loading} />
        </div>

        <div>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Users by role</h2>
          <UsersByRoleChart data={data?.userCounts.byRole ?? null} loading={loading} />
        </div>
      </div>
    </div>
  );
}
