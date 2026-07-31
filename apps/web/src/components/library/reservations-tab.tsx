"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReservationStatusBadge } from "./loan-status-badge";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { BookReservation } from "./types";

export function ReservationsTab() {
  const { data: reservations, loading, refetch } = useApi<BookReservation[]>("/api/book-reservations");

  async function handleCancel(id: string) {
    try {
      await apiFetch(`/api/book-reservations/${id}/cancel`, { method: "POST" });
      toast.success("Reservation cancelled");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to cancel reservation");
    }
  }

  const active = (reservations ?? []).filter((r) => r.status === "PENDING" || r.status === "READY");

  return (
    <div className="flex flex-col gap-4">
      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : active.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No active reservations.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Book</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Reserved on</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.book.title}</TableCell>
                  <TableCell>
                    {r.student.user.firstName} {r.student.user.lastName}
                    <div className="text-xs text-muted-foreground">{r.student.admissionNo}</div>
                  </TableCell>
                  <TableCell>{formatDate(r.reservedAt)}</TableCell>
                  <TableCell>
                    <ReservationStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => handleCancel(r.id)}>
                      Cancel
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
