"use client";

import { Download } from "lucide-react";
import { toast } from "sonner";
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
import { apiFetchBlob, downloadBlob, ApiError } from "@/lib/api-client";
import { attendanceTone } from "@/lib/attendance-tone";
import { cn } from "@/lib/utils";

interface SubjectMark {
  subjectId: string;
  marksObtained: number | null;
  isAbsent: boolean;
  percentage: number | null;
  grade: string | null;
}

interface ResultSheetStudent {
  studentId: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  subjectMarks: SubjectMark[];
  overallPercentage: number | null;
  overallGrade: string | null;
  rank: number | null;
}

interface ResultSheet {
  exam: { id: string; name: string; classId: string; className: string };
  subjects: { subjectId: string; subjectName: string; maxMarks: number }[];
  students: ResultSheetStudent[];
}

const TONE_TEXT = {
  good: "text-status-good",
  warning: "text-status-warning",
  critical: "text-status-critical",
} as const;

async function downloadPdf(examId: string) {
  try {
    const blob = await apiFetchBlob(`/api/exams/${examId}/result-sheet/pdf`);
    downloadBlob(blob, "class-result-sheet.pdf");
  } catch (err) {
    toast.error(err instanceof ApiError ? err.message : "Failed to download result sheet");
  }
}

export function ClassResultSheetTab({ examId }: { examId: string }) {
  const { data: sheet, loading } = useApi<ResultSheet>(`/api/exams/${examId}/result-sheet`);

  if (loading) return <Skeleton className="h-64 rounded-xl" />;
  if (!sheet || sheet.students.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No active students in this class.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => downloadPdf(examId)}>
          <Download className="size-4" />
          Download PDF
        </Button>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Admission no.</TableHead>
              <TableHead>Name</TableHead>
              {sheet.subjects.map((s) => (
                <TableHead key={s.subjectId} className="text-center">
                  {s.subjectName}
                  <div className="text-xs font-normal text-muted-foreground">/{s.maxMarks}</div>
                </TableHead>
              ))}
              <TableHead className="text-center">Overall</TableHead>
              <TableHead className="text-center">Rank</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sheet.students.map((student) => {
              const marksBySubject = new Map(student.subjectMarks.map((m) => [m.subjectId, m]));
              return (
                <TableRow key={student.studentId}>
                  <TableCell>{student.admissionNo}</TableCell>
                  <TableCell className="font-medium whitespace-nowrap">
                    {student.firstName} {student.lastName}
                  </TableCell>
                  {sheet.subjects.map((s) => {
                    const mark = marksBySubject.get(s.subjectId);
                    return (
                      <TableCell key={s.subjectId} className="text-center">
                        {mark?.isAbsent ? (
                          <span className="text-muted-foreground">Absent</span>
                        ) : mark?.marksObtained !== null && mark?.marksObtained !== undefined ? (
                          mark.marksObtained
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center">
                    {student.overallPercentage !== null ? (
                      <span className={cn("font-medium", TONE_TEXT[attendanceTone(student.overallPercentage)])}>
                        {student.overallPercentage}% ({student.overallGrade})
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Pending</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center font-medium">{student.rank ?? "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
