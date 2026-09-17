"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search as SearchIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { TablePagination } from "@/components/shared/table-pagination";
import { FeeStatusBadge } from "./fee-status-badge";
import { useApi } from "@/lib/use-api";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useServerPagination } from "@/lib/use-server-pagination";
import { formatDate, formatCurrency } from "@/lib/format";
import type { FeeInvoice, FeeInvoiceStatus, FeeSummary } from "./types";
import type { SchoolClass } from "@/components/academics/classes-tab";

const FEE_INVOICE_COLUMN_COUNT = 7;

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
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const { data: classes } = useApi<SchoolClass[]>("/api/classes");

  const { page, setPage, pageSize, setPageSize } = useServerPagination(
    `${classId}:${status}:${overdueOnly}:${debouncedSearch.trim()}`,
  );

  const params = new URLSearchParams();
  if (classId) params.set("classId", classId);
  if (status !== "ALL") params.set("status", status);
  if (overdueOnly) params.set("overdue", "true");
  if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));

  const { data: result, loading } = useApi<{ data: FeeInvoice[]; total: number }>(`/api/fee-invoices?${params.toString()}`);
  const invoices = result?.data;
  const total = result?.total ?? 0;
  const { data: summary } = useApi<FeeSummary>(`/api/fee-invoices/summary?${classId ? `classId=${classId}` : ""}`);

  return (
    <div className="flex flex-col gap-4">
      {summary && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total invoiced</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatCurrency(summary.totalInvoiced)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total collected</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatCurrency(summary.totalCollected)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatCurrency(summary.totalOutstanding)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Unapplied fee credit</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatCurrency(summary.totalUnappliedCredit)}</CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-56">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by student or admission no."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
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

      {!loading && (!invoices || invoices.length === 0) ? (
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
            {loading || !invoices ? (
              <TableSkeleton columns={FEE_INVOICE_COLUMN_COUNT} />
            ) : (
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
                    <TableCell>{formatCurrency(inv.netAmount)}</TableCell>
                    <TableCell>{formatCurrency(inv.balance)}</TableCell>
                    <TableCell>
                      <FeeStatusBadge status={inv.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            )}
          </Table>
          {!loading && (
            <TablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
          )}
        </Card>
      )}
    </div>
  );
}
