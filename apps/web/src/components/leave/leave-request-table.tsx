"use client";

import { CalendarX2, Check, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { LeaveStatusBadge } from "@/components/leave/leave-status-badge";
import { ReviewLeaveDialog } from "@/components/leave/review-leave-dialog";
import { formatDate, formatRole } from "@/lib/format";
import { apiFetch, ApiError } from "@/lib/api-client";
import { toast } from "sonner";
import type { UserRole } from "@sms/shared-types";

export interface LeaveRequestSummary {
  id: string;
  userId: string;
  role: UserRole;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reviewNote: string | null;
  user: { id: string; firstName: string; lastName: string; role: UserRole };
  reviewedBy: { id: string; firstName: string; lastName: string } | null;
}

export function LeaveRequestTable({
  requests,
  showApplicant,
  canReview,
  canCancel,
  onChanged,
}: {
  requests: LeaveRequestSummary[];
  showApplicant?: boolean;
  canReview?: boolean;
  canCancel?: boolean;
  onChanged: () => void;
}) {
  async function handleCancel(id: string) {
    try {
      await apiFetch(`/api/leave-requests/${id}/cancel`, { method: "PATCH" });
      toast.success("Leave request cancelled");
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to cancel leave request");
    }
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
        <CalendarX2 className="size-6" />
        No leave requests.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showApplicant && <TableHead>Applicant</TableHead>}
          <TableHead>Type</TableHead>
          <TableHead>Dates</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {requests.map((r) => (
          <TableRow key={r.id}>
            {showApplicant && (
              <TableCell>
                {r.user.firstName} {r.user.lastName}
                <div className="text-xs text-muted-foreground">{formatRole(r.user.role)}</div>
              </TableCell>
            )}
            <TableCell className="capitalize">{r.leaveType}</TableCell>
            <TableCell>
              {formatDate(r.startDate)} – {formatDate(r.endDate)}
            </TableCell>
            <TableCell className="max-w-64 truncate" title={r.reason}>
              {r.reason}
            </TableCell>
            <TableCell>
              <LeaveStatusBadge status={r.status} />
              {r.reviewNote && (
                <div className="mt-1 text-xs text-muted-foreground">{r.reviewNote}</div>
              )}
            </TableCell>
            <TableCell className="text-right">
              {r.status === "PENDING" && canReview && (
                <div className="flex justify-end gap-1">
                  <ReviewLeaveDialog
                    requestId={r.id}
                    status="APPROVED"
                    onSaved={onChanged}
                    trigger={
                      <Button size="sm" variant="ghost" title="Approve">
                        <Check className="size-3.5" />
                      </Button>
                    }
                  />
                  <ReviewLeaveDialog
                    requestId={r.id}
                    status="REJECTED"
                    onSaved={onChanged}
                    trigger={
                      <Button size="sm" variant="ghost" title="Reject">
                        <X className="size-3.5" />
                      </Button>
                    }
                  />
                </div>
              )}
              {r.status === "PENDING" && canCancel && (
                <ConfirmDialog
                  trigger={
                    <Button size="sm" variant="ghost">
                      Cancel
                    </Button>
                  }
                  title="Cancel this leave request?"
                  description="You can submit a new request afterwards if needed."
                  confirmLabel="Cancel request"
                  destructive
                  onConfirm={() => handleCancel(r.id)}
                />
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
