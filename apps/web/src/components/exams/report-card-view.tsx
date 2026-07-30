"use client";

import { GraduationCap } from "lucide-react";
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

interface ReportCardSubject {
  subjectId: string;
  subjectName: string;
  maxMarks: number;
  marksObtained: number | null;
  isAbsent: boolean;
  percentage: number | null;
  grade: string | null;
}

interface ReportCard {
  exam: { name: string };
  subjects: ReportCardSubject[];
  overall: { percentage: number | null; grade: string | null };
}

export function ReportCardView({ examId, studentId }: { examId: string; studentId: string }) {
  const { data, loading } = useApi<ReportCard>(
    `/api/exams/${examId}/students/${studentId}/report-card`,
  );

  if (loading || !data) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div className="flex flex-col gap-4">
      <div className="sm:w-64">
        <StatCard
          label="Overall result"
          value={data.overall.percentage !== null ? `${data.overall.percentage}%` : "Pending"}
          hint={data.overall.grade ? `Grade ${data.overall.grade}` : "Marks not yet entered"}
          icon={GraduationCap}
          tone={data.overall.percentage !== null ? attendanceTone(data.overall.percentage) : "neutral"}
        />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Max marks</TableHead>
              <TableHead>Marks obtained</TableHead>
              <TableHead>%</TableHead>
              <TableHead>Grade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.subjects.map((s) => (
              <TableRow key={s.subjectId}>
                <TableCell className="font-medium">{s.subjectName}</TableCell>
                <TableCell>{s.maxMarks}</TableCell>
                <TableCell>
                  {s.isAbsent ? (
                    <Badge variant="destructive">Absent</Badge>
                  ) : s.marksObtained !== null ? (
                    s.marksObtained
                  ) : (
                    <span className="text-muted-foreground">Not entered</span>
                  )}
                </TableCell>
                <TableCell>{s.percentage !== null ? `${s.percentage}%` : "—"}</TableCell>
                <TableCell>{s.grade ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
