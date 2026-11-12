"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/lib/use-api";
import { schoolMonthInputValue } from "@/lib/format";

interface ReportRow {
  staffId: string;
  firstName: string;
  lastName: string;
  designation: string;
  present: number;
  absent: number;
  onLeave: number;
  flagged: number;
  missedCheckOut: number;
  attendancePercentage: number | null;
}

interface MonthlyReport {
  month: string;
  schoolDays: number;
  staff: ReportRow[];
}

const COLUMNS: { key: keyof ReportRow; label: string }[] = [
  { key: "present", label: "Present" },
  { key: "absent", label: "Absent" },
  { key: "onLeave", label: "On leave" },
  { key: "missedCheckOut", label: "No check-out" },
  { key: "flagged", label: "Outside range" },
];

function csvCell(value: string | number | null) {
  const text = value === null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(report: MonthlyReport) {
  const header = ["Name", "Designation", ...COLUMNS.map((c) => c.label), "Attendance %"];
  const lines = report.staff.map((r) =>
    [
      `${r.firstName} ${r.lastName}`,
      r.designation,
      ...COLUMNS.map((c) => r[c.key] as number),
      r.attendancePercentage,
    ]
      .map(csvCell)
      .join(","),
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `staff-attendance-${report.month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function MonthlyReportTab() {
  const [month, setMonth] = useState(schoolMonthInputValue);
  const { data: report, loading } = useApi<MonthlyReport>(month ? `/api/staff-attendance/report?month=${month}` : null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="report-month">Month</Label>
          <Input
            id="report-month"
            type="month"
            max={schoolMonthInputValue()}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-44"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={!report || report.staff.length === 0}
          onClick={() => report && downloadCsv(report)}
        >
          <Download className="size-4" />
          Download CSV
        </Button>
      </div>

      {loading || !report ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : report.staff.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">No staff found.</CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {report.schoolDays} school day{report.schoolDays === 1 ? "" : "s"} so far this month (Sundays, off days
            and holidays excluded). Days before a staff member joined, and their own off days, don&apos;t count as
            absent.
          </p>
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  {COLUMNS.map((c) => (
                    <TableHead key={c.key} className="text-right">
                      {c.label}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Attendance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.staff.map((row) => (
                  <TableRow key={row.staffId}>
                    <TableCell>
                      <div className="font-medium">
                        {row.firstName} {row.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground">{row.designation}</div>
                    </TableCell>
                    {COLUMNS.map((c) => (
                      <TableCell key={c.key} className="text-right tabular-nums">
                        {row[c.key] as number}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-medium tabular-nums">
                      {row.attendancePercentage === null ? "—" : `${row.attendancePercentage}%`}
                    </TableCell>
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
