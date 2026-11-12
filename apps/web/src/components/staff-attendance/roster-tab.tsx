"use client";

import { useState } from "react";
import { AlertTriangle, CalendarOff, CheckCircle2, Clock, Plane, XCircle, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/lib/use-api";
import { formatSchoolTime, schoolTodayInputValue } from "@/lib/format";
import { cn } from "@/lib/utils";

export type StaffDayStatus =
  | "PRESENT"
  | "ABSENT"
  | "ON_LEAVE"
  | "HOLIDAY"
  | "OFF_DAY"
  | "PENDING"
  | "UPCOMING"
  | "NOT_JOINED";

interface RosterRow {
  staffId: string;
  firstName: string;
  lastName: string;
  designation: string;
  status: StaffDayStatus;
  checkInAt: string | null;
  checkInFlagged: boolean;
  checkInPhotoUrl: string | null;
  checkOutAt: string | null;
  checkOutFlagged: boolean;
  checkOutPhotoUrl: string | null;
  missedCheckOut: boolean;
}

const STATUS_META: Record<StaffDayStatus, { label: string; icon: LucideIcon; className: string }> = {
  PRESENT: { label: "Present", icon: CheckCircle2, className: "text-status-good" },
  ABSENT: { label: "Absent", icon: XCircle, className: "text-status-critical" },
  ON_LEAVE: { label: "On leave", icon: Plane, className: "text-status-warning" },
  PENDING: { label: "Not checked in yet", icon: Clock, className: "text-muted-foreground" },
  HOLIDAY: { label: "Holiday", icon: CalendarOff, className: "text-muted-foreground" },
  OFF_DAY: { label: "Off day", icon: CalendarOff, className: "text-muted-foreground" },
  UPCOMING: { label: "—", icon: Clock, className: "text-muted-foreground" },
  NOT_JOINED: { label: "Not yet joined", icon: CalendarOff, className: "text-muted-foreground" },
};

export function StatusLabel({ status }: { status: StaffDayStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium">
      <Icon className={cn("size-4 shrink-0", meta.className)} aria-hidden />
      {meta.label}
    </span>
  );
}

function EventCell({ at, flagged, photoUrl }: { at: string | null; flagged: boolean; photoUrl: string | null }) {
  if (!at) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-2">
      {photoUrl && (
        <a href={photoUrl} target="_blank" rel="noopener noreferrer" aria-label="Open selfie">
          {/* Signed storage URL — plain img is fine here. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="" className="size-8 rounded-full border object-cover" />
        </a>
      )}
      <span className="tabular-nums">{formatSchoolTime(at)}</span>
      {flagged && (
        <Badge variant="secondary" className="gap-1">
          <AlertTriangle className="size-3 text-status-warning" aria-hidden />
          Outside range
        </Badge>
      )}
    </div>
  );
}

const SUMMARY: { status: StaffDayStatus; label: string }[] = [
  { status: "PRESENT", label: "Present" },
  { status: "ABSENT", label: "Absent" },
  { status: "ON_LEAVE", label: "On leave" },
  { status: "PENDING", label: "Not checked in yet" },
];

export function RosterTab() {
  const [date, setDate] = useState(schoolTodayInputValue);
  const { data: rows, loading } = useApi<RosterRow[]>(`/api/staff-attendance/roster?date=${date}`);
  const counts = (status: StaffDayStatus) => rows?.filter((r) => r.status === status).length ?? 0;
  const nonWorkingDay = rows && rows.length > 0 && rows.every((r) => r.status === "HOLIDAY" || r.status === "OFF_DAY");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="roster-date">Date</Label>
        <Input
          id="roster-date"
          type="date"
          max={schoolTodayInputValue()}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-44"
        />
      </div>

      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !rows || rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">No staff found.</CardContent>
        </Card>
      ) : (
        <>
          {nonWorkingDay ? (
            <Card>
              <CardContent className="py-4 text-sm text-muted-foreground">
                {rows[0].status === "HOLIDAY" ? "This date is a school holiday." : "This isn't a school day."}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {SUMMARY.map(({ status, label }) => (
                <Card key={status} className="py-0">
                  <CardContent className="flex flex-col gap-1 py-3">
                    <StatusLabel status={status} />
                    <span className="text-2xl font-semibold tabular-nums">{counts(status)}</span>
                    <span className="sr-only">{label}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.staffId}>
                    <TableCell>
                      <div className="font-medium">
                        {row.firstName} {row.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground">{row.designation}</div>
                    </TableCell>
                    <TableCell>
                      <StatusLabel status={row.status} />
                    </TableCell>
                    <TableCell>
                      <EventCell at={row.checkInAt} flagged={row.checkInFlagged} photoUrl={row.checkInPhotoUrl} />
                    </TableCell>
                    <TableCell>
                      {row.missedCheckOut ? (
                        <span className="inline-flex items-center gap-1 text-sm">
                          <AlertTriangle className="size-3.5 text-status-warning" aria-hidden />
                          Didn&apos;t check out
                        </span>
                      ) : (
                        <EventCell
                          at={row.checkOutAt}
                          flagged={row.checkOutFlagged}
                          photoUrl={row.checkOutPhotoUrl}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
