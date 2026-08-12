"use client";

import { useState, type FormEvent, type ReactElement } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  // Reset every field to the *current* balance only on the open transition
  // — adjusted during render, not an effect. Previously this only ran once
  // at mount, so reopening the dialog after a prior payment kept showing
  // the stale pre-payment balance as the default amount.
  const [wasOpen, setWasOpen] = useState(false);
  const [amountPaid, setAmountPaid] = useState(String(balance));
  const [referenceNote, setReferenceNote] = useState("");
  const [confirmOverpay, setConfirmOverpay] = useState(false);
  // One key per genuinely new submission intent (each time the dialog is
  // freshly opened) — a retry of a failed submit reuses this same key, so
  // the server can tell "resend after a dropped response" apart from "the
  // user deliberately submitted again."
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  if (open && !wasOpen) {
    setWasOpen(true);
    setAmountPaid(String(balance));
    setReferenceNote("");
    setConfirmOverpay(false);
    setIdempotencyKey(crypto.randomUUID());
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }
  const [submitting, setSubmitting] = useState(false);

  const parsedAmount = Number(amountPaid) || 0;
  const overpayAmount = Math.max(0, Math.round((parsedAmount - balance) * 100) / 100);
  const isOverpaying = overpayAmount > 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch(`/api/fee-invoices/${invoiceId}/payments`, {
        method: "POST",
        body: JSON.stringify({ amountPaid: parsedAmount, referenceNote: referenceNote || undefined, idempotencyKey }),
      });
      toast.success("Payment recorded");
      setOpen(false);
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
          {isOverpaying && (
            <div className="flex flex-col gap-2 rounded-md border border-status-warning/40 bg-status-warning/10 p-3 text-sm">
              <p>
                This exceeds the outstanding balance by {overpayAmount} — the extra will be added to the student&apos;s
                fee credit balance, usable on any of their other invoices.
              </p>
              <label className="flex items-center gap-2">
                <Checkbox checked={confirmOverpay} onCheckedChange={(v) => setConfirmOverpay(v === true)} />
                I confirm the extra {overpayAmount} should become fee credit
              </label>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={submitting || (isOverpaying && !confirmOverpay)}>
              {submitting ? "Saving…" : "Record payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
