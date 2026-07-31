"use client";

import { useState, type FormEvent, type ReactElement } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiFetch, ApiError } from "@/lib/api-client";

export function RefundDialog({
  trigger,
  paymentId,
  refundable,
  onSaved,
}: {
  trigger: ReactElement;
  paymentId: string;
  refundable: number;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(refundable));
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch(`/api/fee-payments/${paymentId}/refund`, {
        method: "POST",
        body: JSON.stringify({ amount: Number(amount), reason }),
      });
      toast.success("Refund recorded");
      setOpen(false);
      setReason("");
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to record refund");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record refund</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Refundable on this payment: {refundable}. This records the refund as its own ledger entry — it never edits
          or deletes the original payment.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="rf-amount">Refund amount</Label>
            <Input
              id="rf-amount"
              type="number"
              min={0.01}
              max={refundable}
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rf-reason">Reason</Label>
            <Textarea id="rf-reason" required rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={submitting}>
              {submitting ? "Saving…" : "Record refund"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
