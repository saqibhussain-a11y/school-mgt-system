"use client";

import { Eye } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { ReportCardDialog } from "@/components/exams/report-card-dialog";

interface OverviewRow {
  studentId: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  missingSubjects: string[];
  overallPercentage: number | null;
  overallGrade: string | null;
}

const TONE_TEXT: Record<ReturnType<typeof attendanceTone>, string> = {
  good: "text-status-good",
  warning: "text-status-warning",
  critical: "text-status-critical",
};

export function ExamOverviewTab({ examId }: { examId: string }) {
  const { data: rows, loading } = useApi<OverviewRow[]>(`/api/exams/${examId}/overview`);

  if (loading) return <Skeleton className="h-64 rounded-xl" />;
  if (!rows || rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No active students in this class.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Admission no.</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Missing subjects</TableHead>
            <TableHead>Overall</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.studentId}>
              <TableCell>{r.admissionNo}</TableCell>
              <TableCell className="font-medium">
                {r.firstName} {r.lastName}
              </TableCell>
              <TableCell>
                {r.missingSubjects.length === 0 ? (
                  <span className="text-muted-foreground">None</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {r.missingSubjects.map((s) => (
                      <Badge key={s} variant="secondary">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
              </TableCell>
              <TableCell>
                {r.overallPercentage !== null ? (
                  <span className={cn("font-medium", TONE_TEXT[attendanceTone(r.overallPercentage)])}>
                    {r.overallPercentage}% ({r.overallGrade})
                  </span>
                ) : (
                  <span className="text-muted-foreground">Pending</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <ReportCardDialog
                  examId={examId}
                  studentId={r.studentId}
                  studentName={`${r.firstName} ${r.lastName}`}
                  trigger={
                    <Button size="sm" variant="ghost" title="View report card">
                      <Eye className="size-3.5" />
                    </Button>
                  }
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
