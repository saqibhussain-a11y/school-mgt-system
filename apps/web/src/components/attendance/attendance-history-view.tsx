"use client";

import { CalendarCheck } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
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
import { formatDate } from "@/lib/format";

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
  const { data: summary, loading: summaryLoading } = useApi<AttendanceSummary>(
    `/api/attendance/students/${studentId}/summary`,
  );
  const { data: history, loading: historyLoading } = useApi<AttendanceRecord[]>(
    `/api/attendance/students/${studentId}`,
  );

  return (
    <div className="flex flex-col gap-4">
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
