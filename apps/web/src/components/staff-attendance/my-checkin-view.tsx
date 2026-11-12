"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatCalendarDate, formatClockTime, formatSchoolTime } from "@/lib/format";
import { CameraCapture } from "./camera-capture";

interface TodayRow {
  checkInAt: string | null;
  checkInFlagged: boolean;
  checkOutAt: string | null;
  checkOutFlagged: boolean;
}

interface HistoryRow {
  id: string;
  date: string;
  checkInAt: string | null;
  checkInFlagged: boolean;
  checkOutAt: string | null;
  checkOutFlagged: boolean;
}

interface Settings {
  officeLat: number | null;
  radiusMeters: number;
  blockOutsideRadius: boolean;
  checkInWindowStart: string | null;
  checkInWindowEnd: string | null;
  checkOutWindowStart: string | null;
  checkOutWindowEnd: string | null;
}

function windowLabel(start: string | null, end: string | null) {
  return start && end ? `${formatClockTime(start)} – ${formatClockTime(end)}` : "Any time";
}

function OutsideRange() {
  return (
    <Badge variant="secondary" className="ml-2 gap-1">
      <AlertTriangle className="size-3 text-status-warning" aria-hidden />
      Outside range
    </Badge>
  );
}

export function MyCheckInView() {
  const {
    data: today,
    loading,
    error,
    refetch: refetchToday,
  } = useApi<TodayRow | null>("/api/staff-attendance/me/today");
  const { data: history, refetch: refetchHistory } = useApi<HistoryRow[]>(
    error ? null : "/api/staff-attendance/me/history",
  );
  const { data: settings } = useApi<Settings>("/api/staff-attendance-settings");
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"IN" | "OUT" | null>(null);

  async function handleCapture(
    action: "check-in" | "check-out",
    data: { blob: Blob; lat: number; lng: number; accuracy: number },
  ) {
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("photo", data.blob, "photo.jpg");
      formData.append("lat", String(data.lat));
      formData.append("lng", String(data.lng));
      formData.append("accuracy", String(Math.round(data.accuracy)));
      await apiFetch(`/api/staff-attendance/${action}`, { method: "POST", body: formData });
      toast.success(action === "check-in" ? "Checked in" : "Checked out");
      setMode(null);
      refetchToday();
      refetchHistory();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : `Failed to ${action.replace("-", " ")}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Skeleton className="h-64 rounded-xl" />;

  if (error) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {error.includes("staff profile")
            ? "Your account isn't linked to a staff profile, so there's nothing to check in to. Ask your school admin to add you as staff."
            : error}
        </CardContent>
      </Card>
    );
  }

  const canCheckIn = !today?.checkInAt;
  const canCheckOut = !!today?.checkInAt && !today?.checkOutAt;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Today</CardTitle>
          {settings && (
            <CardDescription>
              Check-in: {windowLabel(settings.checkInWindowStart, settings.checkInWindowEnd)} · Check-out:{" "}
              {windowLabel(settings.checkOutWindowStart, settings.checkOutWindowEnd)}
              {settings.officeLat !== null &&
                ` · ${settings.blockOutsideRadius ? "Must be" : "Should be"} within ${settings.radiusMeters} m of school`}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-8 text-sm">
            <div>
              <p className="text-muted-foreground">Check-in</p>
              <p className="font-medium">
                {formatSchoolTime(today?.checkInAt ?? null)}
                {today?.checkInFlagged && <OutsideRange />}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Check-out</p>
              <p className="font-medium">
                {formatSchoolTime(today?.checkOutAt ?? null)}
                {today?.checkOutFlagged && <OutsideRange />}
              </p>
            </div>
          </div>

          {mode ? (
            <div className="flex flex-col items-center gap-2">
              <CameraCapture
                actionLabel={mode === "IN" ? "Check in" : "Check out"}
                submitting={submitting}
                onCapture={(data) => handleCapture(mode === "IN" ? "check-in" : "check-out", data)}
              />
              <Button variant="ghost" size="sm" onClick={() => setMode(null)} disabled={submitting}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              {canCheckIn && (
                <Button size="sm" onClick={() => setMode("IN")}>
                  Check in
                </Button>
              )}
              {canCheckOut && (
                <Button size="sm" onClick={() => setMode("OUT")}>
                  Check out
                </Button>
              )}
              {!canCheckIn && !canCheckOut && (
                <p className="text-sm text-muted-foreground">You&apos;ve checked in and out for today.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          {!history || history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attendance recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{formatCalendarDate(row.date)}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatSchoolTime(row.checkInAt)}
                      {row.checkInFlagged && <OutsideRange />}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {row.checkInAt && !row.checkOutAt ? (
                        <span className="text-muted-foreground">Not checked out</span>
                      ) : (
                        formatSchoolTime(row.checkOutAt)
                      )}
                      {row.checkOutFlagged && <OutsideRange />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
