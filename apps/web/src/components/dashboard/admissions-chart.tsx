"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, ResponsiveContainer } from "recharts";
import { useChartColors } from "@/lib/chart-colors";

interface AdmissionRow {
  classId: string;
  className: string;
  count: number;
}

export function AdmissionsChart({ rows }: { rows: AdmissionRow[] }) {
  const colors = useChartColors();
  // One consistent hue, not a color per bar — these bars are a single
  // series (admissions count) across categories, not distinct identities
  // that each need their own color; class names are already the direct
  // Y-axis labels.
  const height = Math.max(140, rows.length * 34 + 24);

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 28, left: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="className"
            width={72}
            tick={{ fontSize: 12, fill: "var(--foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            formatter={(value) => [value, "New admissions"]}
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="count" fill={colors.series1} radius={[0, 4, 4, 0]} barSize={20}>
            <LabelList dataKey="count" position="right" style={{ fill: "var(--foreground)", fontSize: 12, fontWeight: 500 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
