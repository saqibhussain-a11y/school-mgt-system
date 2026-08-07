"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import { CreateExamSessionDialog } from "@/components/exam-sessions/create-exam-session-dialog";
import type { ExamSessionSummary } from "@/components/exam-sessions/exam-session-types";

export function ExamSessionsTab({ canManage }: { canManage: boolean }) {
  const router = useRouter();
  const { data: sessions, loading, refetch } = useApi<ExamSessionSummary[]>("/api/exam-sessions");

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <div className="flex justify-end">
          <CreateExamSessionDialog
            onSaved={refetch}
            trigger={
              <Button size="sm">
                <Plus className="size-4" />
                New exam session
              </Button>
            }
          />
        </div>
      )}
      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !sessions || sessions.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No exam sessions yet. Create one to combine multiple classes for shared seating and
            invigilation.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Classes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <TableRow
                  key={session.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/dashboard/exam-sessions/${session.id}`)}
                >
                  <TableCell className="font-medium">{session.name}</TableCell>
                  <TableCell>
                    {formatDate(session.startDate)} – {formatDate(session.endDate)}
                  </TableCell>
                  <TableCell>{session.exams.map((e) => e.class.name).join(", ") || "None yet"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
