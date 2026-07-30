"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { apiFetch, ApiError } from "@/lib/api-client";
import type { ExamSummary } from "@/components/exams/types";

interface MarksSheetRow {
  studentId: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  marksObtained: number | null;
  isAbsent: boolean;
}

interface MarksSheet {
  examSubject: { maxMarks: number };
  students: MarksSheetRow[];
}

export function MarksEntryTab({ exam }: { exam: ExamSummary }) {
  const [examSubjectId, setExamSubjectId] = useState(exam.examSubjects[0]?.id ?? "");
  const {
    data: sheet,
    loading,
    refetch,
  } = useApi<MarksSheet>(examSubjectId ? `/api/exam-subjects/${examSubjectId}/marks` : null);

  const [drafts, setDrafts] = useState<Record<string, { marksObtained: string; isAbsent: boolean }>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!sheet) return;
    const next: Record<string, { marksObtained: string; isAbsent: boolean }> = {};
    for (const row of sheet.students) {
      next[row.studentId] = {
        marksObtained: row.marksObtained !== null ? String(row.marksObtained) : "",
        isAbsent: row.isAbsent,
      };
    }
    setDrafts(next);
  }, [sheet]);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const records = Object.entries(drafts).map(([studentId, d]) => ({
        studentId,
        isAbsent: d.isAbsent,
        marksObtained: d.isAbsent || d.marksObtained === "" ? null : Number(d.marksObtained),
      }));
      await apiFetch(`/api/exam-subjects/${examSubjectId}/marks`, {
        method: "POST",
        body: JSON.stringify({ records }),
      });
      toast.success("Marks saved");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save marks");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="w-64">
        <Label className="mb-2 block text-xs text-muted-foreground">Subject</Label>
        <Select
          items={exam.examSubjects.map((es) => ({
            value: es.id,
            label: `${es.subject.name} (max ${es.maxMarks})`,
          }))}
          value={examSubjectId}
          onValueChange={(v) => setExamSubjectId(v ?? "")}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select subject" />
          </SelectTrigger>
          <SelectContent>
            {exam.examSubjects.map((es) => (
              <SelectItem key={es.id} value={es.id}>
                {es.subject.name} (max {es.maxMarks})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !sheet || sheet.students.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No active students in this class.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Admission no.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-40">Marks (max {sheet.examSubject.maxMarks})</TableHead>
                  <TableHead className="w-28">Absent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sheet.students.map((student) => {
                  const draft = drafts[student.studentId] ?? { marksObtained: "", isAbsent: false };
                  return (
                    <TableRow key={student.studentId}>
                      <TableCell>{student.admissionNo}</TableCell>
                      <TableCell className="font-medium">
                        {student.firstName} {student.lastName}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={sheet.examSubject.maxMarks}
                          disabled={draft.isAbsent}
                          value={draft.marksObtained}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [student.studentId]: { ...draft, marksObtained: e.target.value },
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={draft.isAbsent}
                          onCheckedChange={(checked) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [student.studentId]: { ...draft, isAbsent: checked === true },
                            }))
                          }
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Saving…" : "Save marks"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
