"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { formatDate } from "@/lib/format";
import { GenerateSeatingDialog } from "@/components/exam-sessions/generate-seating-dialog";
import { GenerateInvigilationDialog } from "@/components/exam-sessions/generate-invigilation-dialog";
import type { ExamSessionSummary } from "@/components/exam-sessions/exam-session-types";

interface SeatAllocationRow {
  id: string;
  seatNumber: number;
  room: { id: string; name: string };
  student: { admissionNo: string; user: { firstName: string; lastName: string } };
  classId: string;
  sectionId: string;
}

interface InvigilationRow {
  id: string;
  examDate: string;
  startTime: string;
  endTime: string;
  room: { name: string };
  staff: { user: { firstName: string; lastName: string } };
}

function DownloadAdmitCardsButton({ examSessionId }: { examSessionId: string }) {
  async function handleDownload() {
    try {
      const blob = await apiFetchBlob(`/api/exam-sessions/${examSessionId}/admit-cards`);
      downloadBlob(blob, "admit-cards.pdf");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to download admit cards");
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={handleDownload}>
      <Download className="size-4" />
      Download admit cards
    </Button>
  );
}

function SeatingChart({ examSessionId }: { examSessionId: string }) {
  const { data: seats, loading } = useApi<SeatAllocationRow[]>(`/api/exam-sessions/${examSessionId}/seating`);

  if (loading) return <Skeleton className="h-64 rounded-xl" />;
  if (!seats || seats.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No seating generated yet.
        </CardContent>
      </Card>
    );
  }

  const byRoom = new Map<string, SeatAllocationRow[]>();
  for (const seat of seats) {
    const arr = byRoom.get(seat.room.name) ?? [];
    arr.push(seat);
    byRoom.set(seat.room.name, arr);
  }

  return (
    <div className="flex flex-col gap-4">
      {Array.from(byRoom.entries()).map(([roomName, rows]) => (
        <Card key={roomName}>
          <CardContent className="pt-4">
            <p className="mb-2 font-medium">{roomName}</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Seat</TableHead>
                  <TableHead>Admission No.</TableHead>
                  <TableHead>Student</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows
                  .sort((a, b) => a.seatNumber - b.seatNumber)
                  .map((seat) => (
                    <TableRow key={seat.id}>
                      <TableCell>{seat.seatNumber}</TableCell>
                      <TableCell>{seat.student.admissionNo}</TableCell>
                      <TableCell>
                        {seat.student.user.firstName} {seat.student.user.lastName}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function InvigilationRoster({ examSessionId }: { examSessionId: string }) {
  const { data: duties, loading } = useApi<InvigilationRow[]>(
    `/api/exam-sessions/${examSessionId}/invigilation`,
  );

  if (loading) return <Skeleton className="h-64 rounded-xl" />;
  if (!duties || duties.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No invigilation roster generated yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Room</TableHead>
            <TableHead>Invigilator</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {duties.map((duty) => (
            <TableRow key={duty.id}>
              <TableCell>{formatDate(duty.examDate)}</TableCell>
              <TableCell>
                {duty.startTime} – {duty.endTime}
              </TableCell>
              <TableCell>{duty.room.name}</TableCell>
              <TableCell>
                {duty.staff.user.firstName} {duty.staff.user.lastName}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

export default function ExamSessionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const { data: session, loading, refetch } = useApi<ExamSessionSummary>(
    `/api/exam-sessions/${params.id}`,
  );

  if (loading || !session) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/exams")}>
          <ArrowLeft className="size-4" />
          Back to exams
        </Button>
        <Skeleton className="mt-4 h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-2" onClick={() => router.push("/dashboard/exams")}>
        <ArrowLeft className="size-4" />
        Back to exams
      </Button>
      <PageHeader
        title={session.name}
        description={`${formatDate(session.startDate)} – ${formatDate(session.endDate)} · ${session.exams.map((e) => e.class.name).join(", ") || "No classes linked yet"}`}
        action={
          <div className="flex flex-wrap gap-2">
            <GenerateSeatingDialog
              examSessionId={session.id}
              onGenerated={refetch}
              trigger={
                <Button size="sm">
                  <Sparkles className="size-4" />
                  Generate seating
                </Button>
              }
            />
            <GenerateInvigilationDialog
              examSessionId={session.id}
              onGenerated={refetch}
              trigger={
                <Button size="sm" variant="outline">
                  <Sparkles className="size-4" />
                  Generate invigilation
                </Button>
              }
            />
            <DownloadAdmitCardsButton examSessionId={session.id} />
          </div>
        }
      />

      <Tabs defaultValue="seating">
        <TabsList>
          <TabsTrigger value="seating">Seating</TabsTrigger>
          <TabsTrigger value="invigilation">Invigilation</TabsTrigger>
        </TabsList>
        <TabsContent value="seating" className="mt-4">
          <SeatingChart examSessionId={session.id} />
        </TabsContent>
        <TabsContent value="invigilation" className="mt-4">
          <InvigilationRoster examSessionId={session.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
