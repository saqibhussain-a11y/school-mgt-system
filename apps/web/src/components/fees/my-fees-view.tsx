"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FeeStatusBadge } from "./fee-status-badge";
import { useApi } from "@/lib/use-api";
import { formatDate } from "@/lib/format";
import type { FeeInvoice } from "./types";

interface DashboardResponse {
  role: string;
  widgets: {
    studentId?: string | null;
    children?: { studentId: string; classId: string; name: string }[];
  };
}

function StudentInvoices({ studentId }: { studentId: string }) {
  const router = useRouter();
  const { data: invoices, loading } = useApi<FeeInvoice[]>(`/api/fee-invoices/student/${studentId}`);

  if (loading) return <Skeleton className="h-48 rounded-xl" />;
  if (!invoices || invoices.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">No invoices yet.</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
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
            <TableRow key={inv.id} className="cursor-pointer" onClick={() => router.push(`/dashboard/fees/${inv.id}`)}>
              <TableCell className="font-medium capitalize">{inv.feeStructure.category}</TableCell>
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
  );
}

export function MyFeesView() {
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
    return <StudentInvoices studentId={data.widgets.studentId} />;
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
        {selected && <StudentInvoices studentId={selected.studentId} />}
      </div>
    );
  }

  return null;
}
