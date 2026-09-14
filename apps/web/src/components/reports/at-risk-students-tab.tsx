"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
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

interface ClassOption {
  id: string;
  name: string;
}

interface AtRiskRow {
  studentId: string;
  firstName: string;
  lastName: string;
  className: string;
  sectionName: string;
  reasons: string[];
  attendancePercentage: number | null;
  latestExamPercentage: number | null;
}

// Table, not a chart — this is "which students, and why", a categorical
// list rather than a trend, so a table is the honest shape here.
export function AtRiskStudentsTab({ isTeacher, classes }: { isTeacher: boolean; classes: ClassOption[] }) {
  const [classId, setClassId] = useState("");

  useEffect(() => {
    if (isTeacher && !classId && classes.length > 0) setClassId(classes[0].id);
  }, [isTeacher, classId, classes]);

  const params = new URLSearchParams();
  if (classId) params.set("classId", classId);
  const query = params.toString();
  const path = `/api/reports/at-risk-students${query ? `?${query}` : ""}`;
  const { data, loading } = useApi<AtRiskRow[]>(isTeacher && !classId ? null : path);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
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
        <ExportButtons path={path} filenameBase="at-risk-students" />
      </div>

      <div className="sm:w-64">
        <StatCard
          label="Students flagged"
          value={data?.length ?? 0}
          hint="Attendance <75% (30d) or a declining/failing exam trend"
          icon={AlertTriangle}
        />
      </div>

      {loading ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : !data || data.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No students are flagged as at-risk right now.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Attendance</TableHead>
                <TableHead>Latest exam</TableHead>
                <TableHead>Why</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.studentId}>
                  <TableCell className="font-medium">
                    <Link href={`/dashboard/students/${row.studentId}`} className="hover:underline">
                      {row.firstName} {row.lastName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {row.className} {row.sectionName}
                  </TableCell>
                  <TableCell>{row.attendancePercentage !== null ? `${row.attendancePercentage}%` : "—"}</TableCell>
                  <TableCell>{row.latestExamPercentage !== null ? `${row.latestExamPercentage}%` : "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.reasons.join(" · ")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
