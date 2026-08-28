"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useChartColors } from "@/lib/chart-colors";

interface GrowthChurnPoint {
  month: string;
  created: number;
  churned: number;
}

export function GrowthChurnChart({ data, loading }: { data: GrowthChurnPoint[] | null; loading: boolean }) {
  const colors = useChartColors();

  if (loading) return <Skeleton className="h-72 rounded-xl" />;
  if (!data || data.every((d) => d.created === 0 && d.churned === 0)) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No school activity in the last 12 months yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="h-72 pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 12, left: -12, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              width={32}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="created" name="Schools added" fill={colors.series1} radius={[4, 4, 0, 0]} />
            <Bar dataKey="churned" name="Schools suspended" fill={colors.series3} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
