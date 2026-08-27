"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/lib/use-api";
import { toDateInputValue } from "@/lib/format";

interface RosterRow {
  staffId: string;
  firstName: string;
  lastName: string;
  checkInAt: string | null;
  checkInFlagged: boolean;
  checkInPhotoUrl: string | null;
  checkOutAt: string | null;
  checkOutFlagged: boolean;
  checkOutPhotoUrl: string | null;
}

function formatTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function EventCell({
  at,
  flagged,
  photoUrl,
}: {
  at: string | null;
  flagged: boolean;
  photoUrl: string | null;
}) {
  if (!at) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-2">
      {photoUrl && (
        // A small thumbnail of the check-in/out selfie — plain img is fine here.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="size-8 rounded-full border object-cover" />
      )}
      <span>{formatTime(at)}</span>
      {flagged && (
        <Badge variant="secondary" className="text-status-warning">
          Outside range
        </Badge>
      )}
    </div>
  );
}

export function RosterTab() {
  const [date, setDate] = useState(toDateInputValue(new Date()));
  const { data: rows, loading } = useApi<RosterRow[]>(`/api/staff-attendance/roster?date=${date}`);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="roster-date">Date</Label>
          <Input
            id="roster-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-44"
          />
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !rows || rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No staff found.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Check-out</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.staffId}>
                  <TableCell className="font-medium">
                    {row.firstName} {row.lastName}
                  </TableCell>
                  <TableCell>
                    <EventCell at={row.checkInAt} flagged={row.checkInFlagged} photoUrl={row.checkInPhotoUrl} />
                  </TableCell>
                  <TableCell>
                    <EventCell
                      at={row.checkOutAt}
                      flagged={row.checkOutFlagged}
                      photoUrl={row.checkOutPhotoUrl}
                    />
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
