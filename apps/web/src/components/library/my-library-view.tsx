"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { LoanStatusBadge, ReservationStatusBadge } from "./loan-status-badge";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { Book, BookLoan, BookReservation } from "./types";

interface DashboardResponse {
  role: string;
  widgets: {
    studentId?: string | null;
    children?: { studentId: string; classId: string; name: string }[];
  };
}

function StudentLibrary({ studentId }: { studentId: string }) {
  const [query, setQuery] = useState("");
  const { data: loans, loading: loansLoading } = useApi<BookLoan[]>(`/api/book-loans/student/${studentId}`);
  const { data: reservations, loading: reservationsLoading, refetch: refetchReservations } = useApi<BookReservation[]>(
    `/api/book-reservations/student/${studentId}`,
  );
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  const { data: books, loading: booksLoading } = useApi<Book[]>(`/api/library-books?${params.toString()}`);

  const activeReservedBookIds = new Set(
    (reservations ?? []).filter((r) => r.status === "PENDING" || r.status === "READY").map((r) => r.bookId),
  );
  const activeLoanBookIds = new Set((loans ?? []).filter((l) => l.status === "ACTIVE").map((l) => l.bookId));

  async function handleReserve(bookId: string) {
    try {
      await apiFetch("/api/book-reservations", { method: "POST", body: JSON.stringify({ bookId, studentId }) });
      toast.success("Reserved — you'll be notified when a copy is available");
      refetchReservations();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to reserve book");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">My loans</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loansLoading ? (
            <Skeleton className="m-4 h-32 rounded-xl" />
          ) : !loans || loans.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">No books borrowed yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Book</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Fine</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell className="font-medium">{loan.book.title}</TableCell>
                    <TableCell>{formatDate(loan.issueDate)}</TableCell>
                    <TableCell>{formatDate(loan.dueDate)}</TableCell>
                    <TableCell>{loan.fine > 0 ? loan.fine : "—"}</TableCell>
                    <TableCell>
                      <LoanStatusBadge loan={loan} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">My reservations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {reservationsLoading ? (
            <Skeleton className="m-4 h-24 rounded-xl" />
          ) : !reservations || reservations.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">No reservations.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Book</TableHead>
                  <TableHead>Reserved on</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservations.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.book.title}</TableCell>
                    <TableCell>{formatDate(r.reservedAt)}</TableCell>
                    <TableCell>
                      <ReservationStatusBadge status={r.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Browse catalog</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Input
            placeholder="Search by title, author, or ISBN"
            className="w-64"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {booksLoading ? (
            <Skeleton className="h-32 rounded-xl" />
          ) : !books || books.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No books found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {books.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.title}</TableCell>
                    <TableCell>{b.author}</TableCell>
                    <TableCell>
                      {b.availableCopies} / {b.totalCopies}
                    </TableCell>
                    <TableCell className="text-right">
                      {activeLoanBookIds.has(b.id) ? (
                        <span className="text-xs text-muted-foreground">Already on loan to you</span>
                      ) : b.availableCopies > 0 ? (
                        <span className="text-xs text-muted-foreground">Available at the library</span>
                      ) : activeReservedBookIds.has(b.id) ? (
                        <span className="text-xs text-muted-foreground">Reserved</span>
                      ) : (
                        <ConfirmDialog
                          trigger={
                            <Button size="sm" variant="outline">
                              Reserve
                            </Button>
                          }
                          title={`Reserve "${b.title}"?`}
                          description="You'll be notified when a copy becomes available. First to check it out at the library still gets it."
                          confirmLabel="Reserve"
                          onConfirm={() => handleReserve(b.id)}
                        />
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

export function MyLibraryView() {
  const { data, loading } = useApi<DashboardResponse>("/api/dashboard");
  const [selectedChild, setSelectedChild] = useState("");

  const children = data?.widgets.children ?? [];
  useEffect(() => {
    if (!selectedChild && children.length > 0) setSelectedChild(children[0].studentId);
  }, [children, selectedChild]);

  if (loading || !data) return <Skeleton className="h-64 rounded-xl" />;

  if (data.role === "STUDENT") {
    if (!data.widgets.studentId) {
      return (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No student profile linked to this account yet.
          </CardContent>
        </Card>
      );
    }
    return <StudentLibrary studentId={data.widgets.studentId} />;
  }

  if (data.role === "PARENT") {
    if (children.length === 0) {
      return (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No children are linked to your account yet.
          </CardContent>
        </Card>
      );
    }
    const selected = children.find((c) => c.studentId === selectedChild);
    return (
      <div className="flex flex-col gap-4">
        <div className="w-64">
          <Select
            items={children.map((c) => ({ value: c.studentId, label: c.name }))}
            value={selectedChild}
            onValueChange={(v) => setSelectedChild(v ?? "")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select child" />
            </SelectTrigger>
            <SelectContent>
              {children.map((child) => (
                <SelectItem key={child.studentId} value={child.studentId}>
                  {child.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selected && <StudentLibrary studentId={selected.studentId} />}
      </div>
    );
  }

  return null;
}
