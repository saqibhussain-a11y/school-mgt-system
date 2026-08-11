"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Bell, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { FeeStatusBadge } from "@/components/fees/fee-status-badge";
import { RecordPaymentDialog } from "@/components/fees/record-payment-dialog";
import { RefundDialog } from "@/components/fees/refund-dialog";
import { ApplyCreditDialog } from "@/components/fees/apply-credit-dialog";
import { EditDiscountDialog } from "@/components/fees/edit-discount-dialog";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, apiFetchBlob, downloadBlob, ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { FeeInvoice } from "@/components/fees/types";

const FEE_MANAGE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT"];

export default function FeeInvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const canManage = !!user && FEE_MANAGE_ROLES.includes(user.role);

  const { data: invoice, loading, refetch } = useApi<FeeInvoice>(`/api/fee-invoices/${params.id}`);
  const { data: creditData, refetch: refetchCredit } = useApi<{ creditBalance: number }>(
    invoice ? `/api/fee-invoices/student/${invoice.studentId}/credit-balance` : null,
  );
  const creditBalance = creditData?.creditBalance ?? 0;

  function refetchAll() {
    refetch();
    refetchCredit();
  }

  async function handleDownload() {
    try {
      const blob = await apiFetchBlob(`/api/fee-invoices/${params.id}/pdf`);
      downloadBlob(blob, `invoice-${params.id.slice(-8)}.pdf`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to download invoice");
    }
  }

  async function handleRemind() {
    try {
      await apiFetch(`/api/fee-invoices/${params.id}/remind`, { method: "POST" });
      toast.success("Reminder sent");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to send reminder");
    }
  }

  async function handleDelete() {
    try {
      await apiFetch(`/api/fee-invoices/${params.id}`, { method: "DELETE" });
      toast.success("Invoice deleted");
      router.push("/dashboard/fees");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete invoice");
    }
  }

  if (loading || !invoice) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/fees")}>
          <ArrowLeft className="size-4" />
          Back to fees
        </Button>
        <Skeleton className="mt-4 h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-2" onClick={() => router.push("/dashboard/fees")}>
        <ArrowLeft className="size-4" />
        Back to fees
      </Button>
      <PageHeader
        title={`${invoice.student.user.firstName} ${invoice.student.user.lastName} — ${invoice.feeStructure.category}`}
        description={`${invoice.period} · Due ${formatDate(invoice.dueDate)}`}
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleDownload}>
              <Download className="size-4" />
              Download invoice
            </Button>
            {canManage && invoice.balance > 0 && (
              <Button size="sm" variant="outline" onClick={handleRemind}>
                <Bell className="size-4" />
                Send reminder
              </Button>
            )}
            {canManage && invoice.payments.length === 0 && (
              <ConfirmDialog
                trigger={
                  <Button size="sm" variant="destructive">
                    <Trash2 className="size-4" />
                    Delete
                  </Button>
                }
                title="Delete this invoice?"
                description="Only possible because no payments have been recorded yet."
                confirmLabel="Delete"
                destructive
                onConfirm={handleDelete}
              />
            )}
          </div>
        }
      />

      <div className="flex flex-col gap-4">
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 py-4 sm:grid-cols-4">
            <div>
              <div className="text-xs text-muted-foreground">Amount</div>
              <div className="text-lg font-semibold">{invoice.amount}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Discount</div>
              <div className="flex items-center gap-2 text-lg font-semibold">
                {invoice.discountAmount}
                {canManage && invoice.payments.length === 0 && (
                  <EditDiscountDialog
                    invoiceId={invoice.id}
                    amount={invoice.amount}
                    discountAmount={invoice.discountAmount}
                    onSaved={refetch}
                    trigger={
                      <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs">
                        Edit
                      </Button>
                    }
                  />
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Balance</div>
              <div className="text-lg font-semibold">{invoice.balance}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Status</div>
              <FeeStatusBadge status={invoice.status} />
            </div>
            {creditBalance > 0 && (
              <div>
                <div className="text-xs text-muted-foreground">Student credit balance</div>
                <div className="text-lg font-semibold">{creditBalance}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Payments</CardTitle>
            {canManage && (
              <div className="flex gap-2">
                {invoice.balance > 0 && creditBalance > 0 && (
                  <ApplyCreditDialog
                    invoiceId={invoice.id}
                    balance={invoice.balance}
                    creditBalance={creditBalance}
                    onSaved={refetchAll}
                    trigger={
                      <Button size="sm" variant="outline">
                        Apply credit
                      </Button>
                    }
                  />
                )}
                <RecordPaymentDialog
                  invoiceId={invoice.id}
                  balance={invoice.balance}
                  onSaved={refetchAll}
                  trigger={<Button size="sm">Record payment</Button>}
                />
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {invoice.payments.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">No payments recorded yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Refunded</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.payments.map((p) => {
                    const refunded = p.refunds.reduce((s, r) => s + r.amount, 0);
                    const refundable = Math.round((p.amountPaid - refunded) * 100) / 100;
                    return (
                      <TableRow key={p.id}>
                        <TableCell>{formatDate(p.paymentDate)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {p.amountPaid}
                            {p.paymentMethod === "CREDIT" && <Badge variant="secondary">Credit</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{p.referenceNote || "—"}</TableCell>
                        <TableCell>
                          {refunded > 0 ? (
                            <span>
                              {refunded}
                              {p.refunds.map((r) => (
                                <div key={r.id} className="text-xs text-muted-foreground">
                                  {r.reason}
                                </div>
                              ))}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            {refundable > 0 && (
                              <RefundDialog
                                paymentId={p.id}
                                refundable={refundable}
                                onSaved={refetchAll}
                                trigger={
                                  <Button size="sm" variant="ghost">
                                    {p.paymentMethod === "CREDIT" ? "Un-apply" : "Refund"}
                                  </Button>
                                }
                              />
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
