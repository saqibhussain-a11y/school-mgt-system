"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PayslipStatusBadge } from "./payslip-status-badge";
import { GeneratePayslipsDialog } from "./generate-payslips-dialog";
import { useApi } from "@/lib/use-api";
import { formatCurrency } from "@/lib/format";
import type { Payslip } from "./types";

export function PayslipsTab() {
  const router = useRouter();
  const [period, setPeriod] = useState("");

  const { data: payslips, loading, refetch } = useApi<Payslip[]>(
    `/api/payroll${period ? `?period=${period}` : ""}`,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Input type="month" className="w-44" value={period} onChange={(e) => setPeriod(e.target.value)} />
        <GeneratePayslipsDialog
          trigger={
            <Button size="sm">
              <Plus className="size-4" />
              Generate payslips
            </Button>
          }
          onSaved={refetch}
        />
      </div>

      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !payslips || payslips.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No payslips {period ? "for this month" : "yet"}.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Base salary</TableHead>
                <TableHead>Net pay</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payslips.map((p) => (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => router.push(`/dashboard/payroll/${p.id}`)}>
                  <TableCell className="font-medium">
                    {p.staff.user.firstName} {p.staff.user.lastName}
                  </TableCell>
                  <TableCell>{p.staff.designation}</TableCell>
                  <TableCell>{p.period}</TableCell>
                  <TableCell>{formatCurrency(p.baseSalary)}</TableCell>
                  <TableCell>{formatCurrency(p.netPay)}</TableCell>
                  <TableCell>
                    <PayslipStatusBadge status={p.status} />
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
