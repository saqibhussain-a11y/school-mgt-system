"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
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

function formatTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function MyCheckInView() {
  const {
    data: today,
    loading,
    refetch: refetchToday,
  } = useApi<TodayRow | null>("/api/staff-attendance/me/today");
  const { data: history, refetch: refetchHistory } = useApi<HistoryRow[]>("/api/staff-attendance/me/history");
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"IN" | "OUT" | null>(null);

  async function handleCapture(
    action: "check-in" | "check-out",
    data: { blob: Blob; lat: number; lng: number },
  ) {
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("photo", data.blob, "photo.jpg");
      formData.append("lat", String(data.lat));
      formData.append("lng", String(data.lng));
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

  const canCheckIn = !today?.checkInAt;
  const canCheckOut = !!today?.checkInAt && !today?.checkOutAt;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Today</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-8 text-sm">
            <div>
              <p className="text-muted-foreground">Check-in</p>
              <p className="font-medium">
                {formatTime(today?.checkInAt ?? null)}
                {today?.checkInFlagged && (
                  <Badge variant="secondary" className="ml-2 text-status-warning">
                    Outside range
                  </Badge>
                )}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Check-out</p>
              <p className="font-medium">
                {formatTime(today?.checkOutAt ?? null)}
                {today?.checkOutFlagged && (
                  <Badge variant="secondary" className="ml-2 text-status-warning">
                    Outside range
                  </Badge>
                )}
              </p>
            </div>
          </div>

          {mode ? (
            <CameraCapture
              actionLabel={mode === "IN" ? "Check in" : "Check out"}
              submitting={submitting}
              onCapture={(data) => handleCapture(mode === "IN" ? "check-in" : "check-out", data)}
            />
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
                    <TableCell>{formatDate(row.date)}</TableCell>
                    <TableCell>
                      {formatTime(row.checkInAt)}
                      {row.checkInFlagged && (
                        <span className="ml-1 text-xs text-status-warning" title="Outside office range">
                          ⚠
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {formatTime(row.checkOutAt)}
                      {row.checkOutFlagged && (
                        <span className="ml-1 text-xs text-status-warning" title="Outside office range">
                          ⚠
                        </span>
                      )}
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
