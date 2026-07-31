"use client";

import { Pencil } from "lucide-react";
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
import { formatDate } from "@/lib/format";
import { GradeSubmissionDialog } from "@/components/assignments/grade-submission-dialog";

interface SubmissionRow {
  studentId: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  submitted: boolean;
  submittedAt: string | null;
  isLate: boolean;
  marksObtained: number | null;
  feedback: string | null;
  percentage: number | null;
  grade: string | null;
}

export function SubmissionsTab({ assignmentId, maxMarks }: { assignmentId: string; maxMarks: number }) {
  const { data: rows, loading, refetch } = useApi<SubmissionRow[]>(
    `/api/assignments/${assignmentId}/submissions`,
  );

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
            <TableHead>Status</TableHead>
            <TableHead>Grade</TableHead>
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
                {!r.submitted ? (
                  <Badge variant="secondary">Not submitted</Badge>
                ) : r.isLate ? (
                  <Badge variant="destructive">Late — {formatDate(r.submittedAt!)}</Badge>
                ) : (
                  <Badge>Submitted {formatDate(r.submittedAt!)}</Badge>
                )}
              </TableCell>
              <TableCell>
                {r.grade ? (
                  <span className="font-medium">
                    {r.percentage}% ({r.grade})
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {r.submitted && (
                  <GradeSubmissionDialog
                    assignmentId={assignmentId}
                    studentId={r.studentId}
                    studentName={`${r.firstName} ${r.lastName}`}
                    maxMarks={maxMarks}
                    currentMarks={r.marksObtained}
                    currentFeedback={r.feedback}
                    onGraded={refetch}
                    trigger={
                      <Button size="sm" variant="ghost" title="Grade">
                        <Pencil className="size-3.5" />
                      </Button>
                    }
                  />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
