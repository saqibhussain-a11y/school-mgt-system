"use client";

import { useState, type FormEvent, type ReactElement } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiFetch, ApiError } from "@/lib/api-client";

export function ReviewLeaveDialog({
  trigger,
  requestId,
  status,
  onSaved,
}: {
  trigger: ReactElement;
  requestId: string;
  status: "APPROVED" | "REJECTED";
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isApprove = status === "APPROVED";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch(`/api/leave-requests/${requestId}/review`, {
        method: "PATCH",
        body: JSON.stringify({ status, reviewNote: reviewNote || undefined }),
      });
      toast.success(isApprove ? "Leave request approved" : "Leave request rejected");
      setOpen(false);
      setReviewNote("");
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to review leave request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isApprove ? "Approve leave request" : "Reject leave request"}</DialogTitle>
          {isApprove ? (
            <DialogDescription>
              Approving a student&apos;s leave will mark those dates as &quot;Leave&quot; in attendance.
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="lr-review-note">Note (optional)</Label>
            <Textarea
              id="lr-review-note"
              rows={3}
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" variant={isApprove ? "default" : "destructive"} disabled={submitting}>
              {submitting ? "Saving…" : isApprove ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
