"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExportButtons } from "./export-buttons";
import { useApi } from "@/lib/use-api";
import { useChartColors } from "@/lib/chart-colors";
import { formatDate, toDateInputValue } from "@/lib/format";
import { CalendarCheck } from "lucide-react";
interface ClassOption {
  id: string;
  name: string;
}

const PRESETS = [
  { key: "week", label: "Last 7 days" },
  { key: "month", label: "Last 30 days" },
  { key: "quarter", label: "Last 90 days" },
] as const;
type PresetKey = (typeof PRESETS)[number]["key"];

function rangeFor(preset: PresetKey) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - { week: 6, month: 29, quarter: 89 }[preset]);
  return { from: toDateInputValue(from), to: toDateInputValue(to) };
}

interface AttendancePoint {
  date: string;
  percentage: number;
  totalMarked: number;
}

// Teachers must pick one of their own classes (enforced server-side too) —
// isTeacher gates whether "All classes" is even offered.
export function AttendanceTrendChart({ isTeacher, classes }: { isTeacher: boolean; classes: ClassOption[] }) {
  const [preset, setPreset] = useState<PresetKey>("month");
  const [classId, setClassId] = useState("");
  const range = rangeFor(preset);
  const colors = useChartColors();

  // classes arrives async (a teacher's /api/me/assignments fetch) — the
  // initial useState default can't see it yet, so pick the first class once
  // it loads rather than firing the trend request with no classId at all.
  useEffect(() => {
    if (isTeacher && !classId && classes.length > 0) setClassId(classes[0].id);
  }, [isTeacher, classId, classes]);

  const params = new URLSearchParams({ from: range.from, to: range.to });
  if (classId) params.set("classId", classId);
  const path = `/api/reports/attendance-trend?${params.toString()}`;
  const { data, loading } = useApi<AttendancePoint[]>(isTeacher && !classId ? null : path);

  const overall =
    data && data.length > 0
      ? Math.round((data.reduce((s, d) => s + d.percentage, 0) / data.length) * 100) / 100
      : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {!isTeacher && (
            <Select
              items={[{ value: "", label: "All classes" }, ...classes.map((c) => ({ value: c.id, label: c.name }))]}
              value={classId}
              onValueChange={(v) => setClassId(v ?? "")}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All classes</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {isTeacher && (
            <Select items={classes.map((c) => ({ value: c.id, label: c.name }))} value={classId} onValueChange={(v) => setClassId(v ?? "")}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex gap-1">
            {PRESETS.map((p) => (
              <Button
                key={p.key}
                size="sm"
                variant={preset === p.key ? "default" : "outline"}
                onClick={() => setPreset(p.key)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
        <ExportButtons path={path} filenameBase="attendance-trend" />
      </div>

      <div className="sm:w-64">
        <StatCard label="Average attendance" value={`${overall}%`} hint={`${data?.length ?? 0} days in range`} icon={CalendarCheck} />
      </div>

      {loading ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : !data || data.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No attendance data for this range.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="h-72 pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => formatDate(d)}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={{ stroke: "var(--border)" }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                  />
                  <Tooltip
                    formatter={(value) => [`${value}%`, "Attendance"]}
                    labelFormatter={(d) => formatDate(d as string)}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="percentage"
                    stroke={colors.series1}
                    strokeWidth={2}
                    dot={{ r: 3, fill: colors.series1 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Attendance %</TableHead>
                  <TableHead>Students marked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <TableRow key={row.date}>
                    <TableCell>{formatDate(row.date)}</TableCell>
                    <TableCell>{row.percentage}%</TableCell>
                    <TableCell>{row.totalMarked}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
