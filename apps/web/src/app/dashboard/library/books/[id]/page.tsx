"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { BookDialog } from "@/components/library/book-dialog";
import { IssueBookDialog } from "@/components/library/issue-book-dialog";
import { LoanStatusBadge, ReservationStatusBadge } from "@/components/library/loan-status-badge";
import { ReturnBookDialog } from "@/components/library/return-book-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { Book, BookLoan, BookReservation } from "@/components/library/types";

const LIBRARY_MANAGE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "LIBRARIAN"];

export default function BookDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const canManage = !!user && LIBRARY_MANAGE_ROLES.includes(user.role);

  const { data: book, loading, refetch } = useApi<Book>(`/api/library-books/${params.id}`);
  const { data: loans, refetch: refetchLoans } = useApi<BookLoan[]>(`/api/book-loans?bookId=${params.id}`);
  const { data: reservations } = useApi<BookReservation[]>(`/api/book-reservations?bookId=${params.id}`);

  async function handleDelete() {
    try {
      await apiFetch(`/api/library-books/${params.id}`, { method: "DELETE" });
      toast.success("Book deleted");
      router.push("/dashboard/library");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete book");
    }
  }

  if (loading || !book) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/library")}>
          <ArrowLeft className="size-4" />
          Back to library
        </Button>
        <Skeleton className="mt-4 h-64 rounded-xl" />
      </div>
    );
  }

  const activeLoans = (loans ?? []).filter((l) => l.status === "ACTIVE");
  const activeReservations = (reservations ?? []).filter((r) => r.status === "PENDING" || r.status === "READY");

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-2" onClick={() => router.push("/dashboard/library")}>
        <ArrowLeft className="size-4" />
        Back to library
      </Button>
      <PageHeader
        title={book.title}
        description={`${book.author}${book.category ? ` · ${book.category}` : ""}`}
        action={
          canManage && (
            <div className="flex gap-2">
              <IssueBookDialog
                book={book}
                onIssued={() => {
                  refetch();
                  refetchLoans();
                }}
                trigger={
                  <Button size="sm" disabled={book.availableCopies === 0}>
                    Issue book
                  </Button>
                }
              />
              <BookDialog
                book={book}
                onSaved={refetch}
                trigger={
                  <Button size="sm" variant="outline">
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                }
              />
              <ConfirmDialog
                trigger={
                  <Button size="sm" variant="destructive">
                    <Trash2 className="size-4" />
                    Delete
                  </Button>
                }
                title="Delete this book?"
                description="Only possible if no copies are currently on loan."
                confirmLabel="Delete"
                destructive
                onConfirm={handleDelete}
              />
            </div>
          )
        }
      />

      <div className="flex flex-col gap-4">
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 py-4 sm:grid-cols-4">
            <div>
              <div className="text-xs text-muted-foreground">ISBN</div>
              <div className="text-lg font-semibold">{book.isbn || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total copies</div>
              <div className="text-lg font-semibold">{book.totalCopies}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Available</div>
              <div className="text-lg font-semibold">{book.availableCopies}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">On loan</div>
              <div className="text-lg font-semibold">{book.totalCopies - book.availableCopies}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active loans</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {activeLoans.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">No copies currently on loan.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Status</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeLoans.map((loan) => (
                    <TableRow key={loan.id}>
                      <TableCell className="font-medium">
                        {loan.student.user.firstName} {loan.student.user.lastName}
                        <div className="text-xs text-muted-foreground">{loan.student.admissionNo}</div>
                      </TableCell>
                      <TableCell>{formatDate(loan.issueDate)}</TableCell>
                      <TableCell>{formatDate(loan.dueDate)}</TableCell>
                      <TableCell>
                        <LoanStatusBadge loan={loan} />
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <ReturnBookDialog
                            loan={loan}
                            onReturned={() => {
                              refetch();
                              refetchLoans();
                            }}
                            trigger={
                              <Button size="sm" variant="outline">
                                Return
                              </Button>
                            }
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reservation queue</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {activeReservations.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">No active reservations.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Reserved on</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeReservations.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.student.user.firstName} {r.student.user.lastName}
                        <div className="text-xs text-muted-foreground">{r.student.admissionNo}</div>
                      </TableCell>
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
      </div>
    </div>
  );
}
