"use client";

import { GraduationCap, Lock } from "lucide-react";
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

interface PreviousTerm {
  termId: string;
  termName: string;
  examName: string;
  subjects: { subjectId: string; percentage: number | null; grade: string | null }[];
}

interface ReportCard {
  exam: { name: string };
  subjects: ReportCardSubject[];
  overall: { percentage: number | null; grade: string | null };
  previousTerms?: PreviousTerm[];
}

export function ReportCardView({ examId, studentId }: { examId: string; studentId: string }) {
  const { data, loading, error } = useApi<ReportCard>(
    `/api/exams/${examId}/students/${studentId}/report-card`,
  );

  if (loading) return <Skeleton className="h-64 rounded-xl" />;

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
          <Lock className="size-5" />
          {error}
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const previousTerms = data.previousTerms ?? [];

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
              {previousTerms.map((t) => (
                <TableHead key={t.termId} className="text-center text-muted-foreground">
                  {t.termName}
                </TableHead>
              ))}
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
                {previousTerms.map((t) => {
                  const prior = t.subjects.find((ps) => ps.subjectId === s.subjectId);
                  return (
                    <TableCell key={t.termId} className="text-center text-muted-foreground">
                      {prior?.percentage !== null && prior?.percentage !== undefined
                        ? `${prior.percentage}% (${prior.grade})`
                        : "—"}
                    </TableCell>
                  );
                })}
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
      {previousTerms.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Earlier terms are shown for reference only — this is not a combined/weighted score.
        </p>
      )}
    </div>
  );
}
