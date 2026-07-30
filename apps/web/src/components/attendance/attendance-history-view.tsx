"use client";

import { useState } from "react";
import { CalendarCheck } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApi } from "@/lib/use-api";
import { attendanceTone } from "@/lib/attendance-tone";
import { formatDate, toDateInputValue } from "@/lib/format";

const PRESETS = [
  { key: "week", label: "Last 7 days" },
  { key: "month", label: "Last 30 days" },
  { key: "all", label: "All time" },
] as const;

type PresetKey = (typeof PRESETS)[number]["key"];

function rangeFor(preset: PresetKey) {
  if (preset === "all") return {};
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (preset === "week" ? 6 : 29));
  return { from: toDateInputValue(from), to: toDateInputValue(to) };
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  remarks: string | null;
}

interface AttendanceSummary {
  totalDays: number;
  percentage: number;
}

export function AttendanceHistoryView({ studentId }: { studentId: string }) {
  const [preset, setPreset] = useState<PresetKey>("month");
  const range = rangeFor(preset);
  const suffix = range.from ? `?from=${range.from}&to=${range.to}` : "";

  const { data: summary, loading: summaryLoading } = useApi<AttendanceSummary>(
    `/api/attendance/students/${studentId}/summary${suffix}`,
  );
  const { data: history, loading: historyLoading } = useApi<AttendanceRecord[]>(
    `/api/attendance/students/${studentId}${suffix}`,
  );

  return (
    <div className="flex flex-col gap-4">
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
      {summaryLoading ? (
        <Skeleton className="h-28 rounded-xl sm:w-64" />
      ) : (
        <div className="sm:w-64">
          <StatCard
            label="Overall attendance"
            value={`${summary?.percentage ?? 0}%`}
            hint={`${summary?.totalDays ?? 0} days on record`}
            icon={CalendarCheck}
            tone={attendanceTone(summary?.percentage ?? 0)}
          />
        </div>
      )}

      {historyLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !history || history.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No attendance records yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>{formatDate(record.date)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{record.status.replace("_", " ")}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{record.remarks ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
