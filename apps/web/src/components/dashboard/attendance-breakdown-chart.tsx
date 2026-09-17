"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList, ResponsiveContainer } from "recharts";

type AttendanceStatus = "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE";

const LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  HALF_DAY: "Half day",
  LEAVE: "Leave",
};

// Status colors, not a categorical palette — these 4 bars are states
// (good/critical/warning/neutral), not arbitrary series identity, so they
// reuse the app's reserved status tokens rather than chart-N hues.
const COLORS: Record<AttendanceStatus, string> = {
  PRESENT: "var(--status-good)",
  ABSENT: "var(--status-critical)",
  HALF_DAY: "var(--status-warning)",
  LEAVE: "var(--muted-foreground)",
};

const ORDER: AttendanceStatus[] = ["PRESENT", "ABSENT", "HALF_DAY", "LEAVE"];

export function AttendanceBreakdownChart({ breakdown }: { breakdown: Partial<Record<AttendanceStatus, number>> }) {
  const data = ORDER.map((status) => ({ status, label: LABELS[status], count: breakdown[status] ?? 0 }));

  return (
    <div style={{ height: 176 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 28, left: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={72}
            tick={{ fontSize: 12, fill: "var(--foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            formatter={(value) => [value, "Students"]}
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
            {data.map((entry) => (
              <Cell key={entry.status} fill={COLORS[entry.status]} />
            ))}
            <LabelList dataKey="count" position="right" style={{ fill: "var(--foreground)", fontSize: 12, fontWeight: 500 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
