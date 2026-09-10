"use client";

import { Download } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PayslipStatusBadge } from "./payslip-status-badge";
import { useApi } from "@/lib/use-api";
import { apiFetchBlob, downloadBlob, ApiError } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format";
import type { Payslip } from "./types";

export function MyPayslipsView() {
  const { data: payslips, loading } = useApi<Payslip[]>("/api/payroll/me");

  async function handleDownload(id: string, period: string) {
    try {
      const blob = await apiFetchBlob(`/api/payroll/me/${id}/pdf`);
      downloadBlob(blob, `payslip-${period}.pdf`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to download payslip");
    }
  }

  if (loading) return <Skeleton className="h-64 rounded-xl" />;

  if (!payslips || payslips.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">No payslips yet.</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Period</TableHead>
            <TableHead>Base salary</TableHead>
            <TableHead>Net pay</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {payslips.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.period}</TableCell>
              <TableCell>{formatCurrency(p.baseSalary)}</TableCell>
              <TableCell>{formatCurrency(p.netPay)}</TableCell>
              <TableCell>
                <PayslipStatusBadge status={p.status} />
              </TableCell>
              <TableCell>
                <Button size="sm" variant="outline" onClick={() => handleDownload(p.id, p.period)}>
                  <Download className="size-4" />
                  Download
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
