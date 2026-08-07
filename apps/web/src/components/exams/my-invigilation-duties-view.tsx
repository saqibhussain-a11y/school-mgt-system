"use client";

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

interface DutyRow {
  id: string;
  examDate: string;
  startTime: string;
  endTime: string;
  room: { name: string };
  examSession: { name: string };
}

export function MyInvigilationDutiesView() {
  const { data: duties, loading } = useApi<DutyRow[]>("/api/me/invigilation-duties");

  if (loading) return <Skeleton className="h-64 rounded-xl" />;
  if (!duties || duties.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No invigilation duties assigned to you yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Exam session</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Room</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {duties.map((duty) => (
            <TableRow key={duty.id}>
              <TableCell className="font-medium">{duty.examSession.name}</TableCell>
              <TableCell>{formatDate(duty.examDate)}</TableCell>
              <TableCell>
                {duty.startTime} – {duty.endTime}
              </TableCell>
              <TableCell>{duty.room.name}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
