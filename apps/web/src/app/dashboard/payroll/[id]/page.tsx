"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { PayslipStatusBadge } from "@/components/payroll/payslip-status-badge";
import { AddAdjustmentDialog } from "@/components/payroll/add-adjustment-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, apiFetchBlob, downloadBlob, ApiError } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format";
import type { Payslip } from "@/components/payroll/types";

const PAYROLL_MANAGE_ROLES = ["SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"];

export default function PayslipDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const canManage = !!user && PAYROLL_MANAGE_ROLES.includes(user.role);

  const { data: payslip, loading, refetch } = useApi<Payslip>(`/api/payroll/${params.id}`);

  async function handleDownload() {
    try {
      const blob = await apiFetchBlob(`/api/payroll/${params.id}/pdf`);
      downloadBlob(blob, `payslip-${payslip?.period ?? params.id}.pdf`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to download payslip");
    }
  }

  async function toggleStatus() {
    if (!payslip) return;
    const next = payslip.status === "PAID" ? "UNPAID" : "PAID";
    try {
      await apiFetch(`/api/payroll/${params.id}/status`, { method: "PATCH", body: JSON.stringify({ status: next }) });
      toast.success(next === "PAID" ? "Marked as paid" : "Marked as unpaid");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update status");
    }
  }

  async function removeAdjustment(adjustmentId: string) {
    try {
      await apiFetch(`/api/payroll/${params.id}/adjustments/${adjustmentId}`, { method: "DELETE" });
      toast.success("Adjustment removed");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to remove adjustment");
    }
  }

  if (loading || !payslip) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/payroll")}>
          <ArrowLeft className="size-4" />
          Back to payroll
        </Button>
        <Skeleton className="mt-4 h-64 rounded-xl" />
      </div>
    );
  }

  const locked = payslip.status === "PAID";

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-2" onClick={() => router.push("/dashboard/payroll")}>
        <ArrowLeft className="size-4" />
        Back to payroll
      </Button>
      <PageHeader
        title={`${payslip.staff.user.firstName} ${payslip.staff.user.lastName} — ${payslip.period}`}
        description={payslip.staff.designation}
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleDownload}>
              <Download className="size-4" />
              Download payslip
            </Button>
            {canManage && (
              <Button size="sm" variant={locked ? "outline" : "default"} onClick={toggleStatus}>
                Mark as {locked ? "unpaid" : "paid"}
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-col gap-4">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-8 py-5">
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">Status</span>
              <PayslipStatusBadge status={payslip.status} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">Base salary</span>
              <span className="text-sm font-medium">{formatCurrency(payslip.baseSalary)}</span>
            </div>
            {payslip.unpaidLeaveDays > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">
                  Unpaid leave ({payslip.unpaidLeaveDays} day{payslip.unpaidLeaveDays === 1 ? "" : "s"})
                </span>
                <span className="text-sm font-medium">-{formatCurrency(payslip.unpaidLeaveDeduction)}</span>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">Net pay</span>
              <span className="text-lg font-semibold">{formatCurrency(payslip.netPay)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Adjustments</CardTitle>
            {canManage && !locked && (
              <AddAdjustmentDialog
                payslipId={payslip.id}
                onSaved={refetch}
                trigger={
                  <Button size="sm" variant="outline">
                    <Plus className="size-4" />
                    Add adjustment
                  </Button>
                }
              />
            )}
          </CardHeader>
          <CardContent>
            {payslip.adjustments.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No adjustments on this payslip.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Amount</TableHead>
                    {canManage && !locked && <TableHead />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payslip.adjustments.map((adj) => (
                    <TableRow key={adj.id}>
                      <TableCell>{adj.label}</TableCell>
                      <TableCell className={adj.amount < 0 ? "text-destructive" : ""}>
                        {adj.amount >= 0 ? "+" : ""}
                        {formatCurrency(adj.amount)}
                      </TableCell>
                      {canManage && !locked && (
                        <TableCell>
                          <ConfirmDialog
                            title="Remove adjustment"
                            description={`Remove "${adj.label}" from this payslip? Net pay will be recalculated.`}
                            confirmLabel="Remove"
                            destructive
                            onConfirm={() => removeAdjustment(adj.id)}
                            trigger={
                              <Button size="sm" variant="ghost">
                                <Trash2 className="size-4" />
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
      </div>
    </div>
  );
}
