"use client";

import { useState, type FormEvent, type ReactElement } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiFetch, ApiError } from "@/lib/api-client";

export function RecordPaymentDialog({
  trigger,
  invoiceId,
  balance,
  onSaved,
}: {
  trigger: ReactElement;
  invoiceId: string;
  balance: number;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amountPaid, setAmountPaid] = useState(String(balance));
  const [referenceNote, setReferenceNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch(`/api/fee-invoices/${invoiceId}/payments`, {
        method: "POST",
        body: JSON.stringify({ amountPaid: Number(amountPaid), referenceNote: referenceNote || undefined }),
      });
      toast.success("Payment recorded");
      setOpen(false);
      setReferenceNote("");
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Manual entry only — record what the parent already paid via bank transfer/cash. Outstanding balance: {balance}.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="rp-amount">Amount paid</Label>
            <Input
              id="rp-amount"
              type="number"
              min={0.01}
              step="0.01"
              required
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rp-ref">Reference / proof (optional)</Label>
            <Input
              id="rp-ref"
              placeholder="Bank transfer ref, receipt no., etc."
              value={referenceNote}
              onChange={(e) => setReferenceNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Record payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
