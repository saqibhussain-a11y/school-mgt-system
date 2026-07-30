"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ReportCardDialog } from "@/components/exams/report-card-dialog";
import type { ExamSummary } from "@/components/exams/types";

interface DashboardResponse {
  role: string;
  widgets: {
    studentId?: string | null;
    classId?: string | null;
    className?: string | null;
    children?: { studentId: string; classId: string; name: string }[];
  };
}

function ChildExams({
  studentId,
  studentName,
  classId,
}: {
  studentId: string;
  studentName: string;
  classId: string;
}) {
  const { data: exams, loading } = useApi<ExamSummary[]>(`/api/exams?classId=${classId}`);

  if (loading) return <Skeleton className="h-48 rounded-xl" />;
  if (!exams || exams.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No exams scheduled yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Exam</TableHead>
            <TableHead>Dates</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {exams.map((exam) => (
            <TableRow key={exam.id}>
              <TableCell className="font-medium">{exam.name}</TableCell>
              <TableCell>
                {formatDate(exam.startDate)} – {formatDate(exam.endDate)}
              </TableCell>
              <TableCell className="text-right">
                <ReportCardDialog
                  examId={exam.id}
                  studentId={studentId}
                  studentName={studentName}
                  trigger={
                    <Button size="sm" variant="outline">
                      View report card
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

export function MyExamsView() {
  const { data, loading } = useApi<DashboardResponse>("/api/dashboard");
  const [selectedChild, setSelectedChild] = useState("");

  const children = data?.widgets.children ?? [];
  useEffect(() => {
    if (!selectedChild && children.length > 0) setSelectedChild(children[0].studentId);
  }, [children, selectedChild]);

  if (loading || !data) return <Skeleton className="h-64 rounded-xl" />;

  if (data.role === "STUDENT") {
    if (!data.widgets.studentId || !data.widgets.classId) {
      return (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No student profile linked to this account yet.
          </CardContent>
        </Card>
      );
    }
    return (
      <ChildExams studentId={data.widgets.studentId} classId={data.widgets.classId} studentName="You" />
    );
  }

  if (data.role === "PARENT") {
    if (children.length === 0) {
      return (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No children are linked to your account yet.
          </CardContent>
        </Card>
      );
    }
    const selected = children.find((c) => c.studentId === selectedChild);
    return (
      <div className="flex flex-col gap-4">
        <div className="w-64">
          <Select
            items={children.map((c) => ({ value: c.studentId, label: c.name }))}
            value={selectedChild}
            onValueChange={(v) => setSelectedChild(v ?? "")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select child" />
            </SelectTrigger>
            <SelectContent>
              {children.map((child) => (
                <SelectItem key={child.studentId} value={child.studentId}>
                  {child.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selected && (
          <ChildExams
            studentId={selected.studentId}
            classId={selected.classId}
            studentName={selected.name}
          />
        )}
      </div>
    );
  }

  return null;
}
