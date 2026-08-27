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
import { useAuth } from "@/lib/auth-context";
import { apiFetch, apiFetchBlob, downloadBlob, ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { GenerateSeatingDialog } from "@/components/exam-sessions/generate-seating-dialog";
import { GenerateInvigilationDialog } from "@/components/exam-sessions/generate-invigilation-dialog";
import { AssignColumnBlockDialog } from "@/components/exam-sessions/assign-column-block-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ExamSessionSummary, SeatingStrategy } from "@/components/exam-sessions/exam-session-types";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"];

interface SeatAllocationRow {
  id: string;
  seatNumber: number;
  room: { id: string; name: string };
  column: { id: string; columnNumber: number } | null;
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

function SeatingChart({
  examSessionId,
  classNameById,
}: {
  examSessionId: string;
  classNameById: Record<string, string>;
}) {
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
      {Array.from(byRoom.entries()).map(([roomName, rows]) => {
        // Column-blocked rooms always carry a column on every row; interleaved
        // rooms never do — branch the whole room's table on that, not a
        // session-level flag, so a page reload always renders what's actually
        // in the data.
        const hasColumns = rows.some((r) => r.column);
        const byColumn = new Map<number, SeatAllocationRow[]>();
        for (const row of rows) {
          const key = row.column?.columnNumber ?? 0;
          const arr = byColumn.get(key) ?? [];
          arr.push(row);
          byColumn.set(key, arr);
        }

        return (
          <Card key={roomName}>
            <CardContent className="flex flex-col gap-4 pt-4">
              <p className="font-medium">{roomName}</p>
              {Array.from(byColumn.entries())
                .sort(([a], [b]) => a - b)
                .map(([columnNumber, columnRows]) => (
                  <div key={columnNumber} className="flex flex-col gap-2">
                    {hasColumns && (
                      <p className="text-sm font-medium text-muted-foreground">Column {columnNumber}</p>
                    )}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Seat</TableHead>
                          <TableHead>Admission No.</TableHead>
                          <TableHead>Student</TableHead>
                          {hasColumns && <TableHead>Class</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {columnRows
                          .sort((a, b) => a.seatNumber - b.seatNumber)
                          .map((seat) => (
                            <TableRow key={seat.id}>
                              <TableCell>{seat.seatNumber}</TableCell>
                              <TableCell>{seat.student.admissionNo}</TableCell>
                              <TableCell>
                                {seat.student.user.firstName} {seat.student.user.lastName}
                              </TableCell>
                              {hasColumns && (
                                <TableCell>{classNameById[seat.classId] ?? "—"}</TableCell>
                              )}
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
            </CardContent>
          </Card>
        );
      })}
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

function SeatingStrategySwitcher({ session, onChanged }: { session: ExamSessionSummary; onChanged: () => void }) {
  async function handleChange(value: string | null) {
    if (!value || value === session.seatingStrategy) return;
    try {
      await apiFetch(`/api/exam-sessions/${session.id}`, {
        method: "PATCH",
        body: JSON.stringify({ seatingStrategy: value as SeatingStrategy }),
      });
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to change seating strategy");
    }
  }

  return (
    <Select
      items={[
        { value: "INTERLEAVED", label: "Interleaved" },
        { value: "COLUMN_BLOCKED", label: "Column-blocked" },
      ]}
      value={session.seatingStrategy}
      onValueChange={handleChange}
    >
      <SelectTrigger size="sm" className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="INTERLEAVED">Interleaved</SelectItem>
        <SelectItem value="COLUMN_BLOCKED">Column-blocked</SelectItem>
      </SelectContent>
    </Select>
  );
}

export default function ExamSessionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = !!user && ADMIN_ROLES.includes(user.role);

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

  const classNameById: Record<string, string> = {};
  for (const e of session.exams) classNameById[e.classId] = e.class.name;
  const isColumnBlocked = session.seatingStrategy === "COLUMN_BLOCKED";

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
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && <SeatingStrategySwitcher session={session} onChanged={refetch} />}
            {isAdmin && isColumnBlocked ? (
              <AssignColumnBlockDialog
                examSessionId={session.id}
                classes={session.exams.map((e) => e.class)}
                onAssigned={refetch}
                trigger={
                  <Button size="sm">
                    <Sparkles className="size-4" />
                    Assign seat block
                  </Button>
                }
              />
            ) : (
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
            )}
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
          <SeatingChart examSessionId={session.id} classNameById={classNameById} />
        </TabsContent>
        <TabsContent value="invigilation" className="mt-4">
          <InvigilationRoster examSessionId={session.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
