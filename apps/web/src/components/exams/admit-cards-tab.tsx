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

interface StudentRow {
  id: string;
  admissionNo: string;
  user: { firstName: string; lastName: string };
}

async function downloadPdf(path: string, filename: string) {
  try {
    const blob = await apiFetchBlob(path);
    downloadBlob(blob, filename);
  } catch (err) {
    toast.error(err instanceof ApiError ? err.message : "Failed to download admit card");
  }
}

export function AdmitCardsTab({ examId, classId }: { examId: string; classId: string }) {
  const { data: students, loading } = useApi<StudentRow[]>(`/api/students?classId=${classId}`);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => downloadPdf(`/api/exams/${examId}/admit-cards`, "admit-cards.pdf")}
        >
          <Download className="size-4" />
          Download all (this class)
        </Button>
      </div>
      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !students || students.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No active students in this class.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Admission No.</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>{student.admissionNo}</TableCell>
                  <TableCell className="font-medium">
                    {student.user.firstName} {student.user.lastName}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Download admit card"
                      onClick={() =>
                        downloadPdf(
                          `/api/exams/${examId}/students/${student.id}/admit-card`,
                          `admit-card-${student.admissionNo}.pdf`,
                        )
                      }
                    >
                      <Download className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
