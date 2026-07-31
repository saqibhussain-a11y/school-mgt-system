"use client";

import { useState } from "react";
import { Bell, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoanStatusBadge } from "./loan-status-badge";
import { ReturnBookDialog } from "./return-book-dialog";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { BookLoan } from "./types";

const FILTERS = [
  { value: "ACTIVE", label: "Active loans" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "RETURNED", label: "Returned" },
  { value: "LOST", label: "Lost" },
];

export function LoansTab() {
  const [filter, setFilter] = useState("ACTIVE");
  const params = new URLSearchParams();
  if (filter === "OVERDUE") params.set("overdue", "true");
  else params.set("status", filter);
  const { data: loans, loading, refetch } = useApi<BookLoan[]>(`/api/book-loans?${params.toString()}`);

  async function handleRemind(id: string) {
    try {
      await apiFetch(`/api/book-loans/${id}/remind`, { method: "POST" });
      toast.success("Reminder sent");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to send reminder");
    }
  }

  async function handleMarkFinePaid(id: string) {
    try {
      await apiFetch(`/api/book-loans/${id}/fine-paid`, { method: "POST" });
      toast.success("Fine marked as paid");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update fine");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Select items={FILTERS} value={filter} onValueChange={(v) => setFilter(v ?? "ACTIVE")}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FILTERS.map((f) => (
            <SelectItem key={f.value} value={f.value}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !loans || loans.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No loans match this filter.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Book</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Fine</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loans.map((loan) => (
                <TableRow key={loan.id}>
                  <TableCell className="font-medium">{loan.book.title}</TableCell>
                  <TableCell>
                    {loan.student.user.firstName} {loan.student.user.lastName}
                    <div className="text-xs text-muted-foreground">{loan.student.admissionNo}</div>
                  </TableCell>
                  <TableCell>{formatDate(loan.issueDate)}</TableCell>
                  <TableCell>{formatDate(loan.dueDate)}</TableCell>
                  <TableCell>
                    {loan.fine > 0 ? (
                      <span className={loan.finePaid ? "text-muted-foreground" : ""}>
                        {loan.fine} {loan.finePaid ? "(paid)" : ""}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <LoanStatusBadge loan={loan} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {loan.status === "ACTIVE" && (
                        <>
                          {new Date(loan.dueDate) < new Date() && (
                            <Button size="sm" variant="ghost" title="Send overdue reminder" onClick={() => handleRemind(loan.id)}>
                              <Bell className="size-3.5" />
                            </Button>
                          )}
                          <ReturnBookDialog
                            loan={loan}
                            onReturned={refetch}
                            trigger={
                              <Button size="sm" variant="outline">
                                Return
                              </Button>
                            }
                          />
                        </>
                      )}
                      {loan.status !== "ACTIVE" && loan.fine > 0 && !loan.finePaid && (
                        <Button size="sm" variant="ghost" title="Mark fine as paid" onClick={() => handleMarkFinePaid(loan.id)}>
                          <Check className="size-3.5" />
                          Mark fine paid
                        </Button>
                      )}
                    </div>
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
