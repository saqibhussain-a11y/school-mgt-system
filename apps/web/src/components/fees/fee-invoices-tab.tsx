"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FeeStatusBadge } from "./fee-status-badge";
import { useApi } from "@/lib/use-api";
import { formatDate } from "@/lib/format";
import type { FeeInvoice, FeeInvoiceStatus, FeeSummary } from "./types";
import type { SchoolClass } from "@/components/academics/classes-tab";

const STATUS_OPTIONS: { value: FeeInvoiceStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All statuses" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "PARTIALLY_PAID", label: "Partially paid" },
  { value: "PAID", label: "Paid" },
];

export function FeeInvoicesTab() {
  const router = useRouter();
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState<FeeInvoiceStatus | "ALL">("ALL");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const { data: classes } = useApi<SchoolClass[]>("/api/classes");

  const params = new URLSearchParams();
  if (classId) params.set("classId", classId);
  if (status !== "ALL") params.set("status", status);
  if (overdueOnly) params.set("overdue", "true");

  const { data: invoices, loading } = useApi<FeeInvoice[]>(`/api/fee-invoices?${params.toString()}`);
  const { data: summary } = useApi<FeeSummary>(`/api/fee-invoices/summary?${classId ? `classId=${classId}` : ""}`);

  return (
    <div className="flex flex-col gap-4">
      {summary && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total invoiced</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{summary.totalInvoiced}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total collected</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{summary.totalCollected}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{summary.totalOutstanding}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Unapplied fee credit</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{summary.totalUnappliedCredit}</CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Select
          items={[{ value: "", label: "All classes" }, ...(classes ?? []).map((c) => ({ value: c.id, label: c.name }))]}
          value={classId}
          onValueChange={(v) => setClassId(v ?? "")}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All classes</SelectItem>
            {(classes ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={STATUS_OPTIONS}
          value={status}
          onValueChange={(v) => setStatus((v as FeeInvoiceStatus | "ALL") ?? "ALL")}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant={overdueOnly ? "default" : "outline"}
          onClick={() => setOverdueOnly((v) => !v)}
        >
          Overdue only
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !invoices || invoices.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No invoices match these filters.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead>Net amount</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow
                  key={inv.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/dashboard/fees/${inv.id}`)}
                >
                  <TableCell className="font-medium">
                    {inv.student.user.firstName} {inv.student.user.lastName}
                    <div className="text-xs text-muted-foreground">{inv.student.admissionNo}</div>
                  </TableCell>
                  <TableCell className="capitalize">{inv.feeStructure.category}</TableCell>
                  <TableCell>{inv.period}</TableCell>
                  <TableCell>{formatDate(inv.dueDate)}</TableCell>
                  <TableCell>{inv.netAmount}</TableCell>
                  <TableCell>{inv.balance}</TableCell>
                  <TableCell>
                    <FeeStatusBadge status={inv.status} />
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
