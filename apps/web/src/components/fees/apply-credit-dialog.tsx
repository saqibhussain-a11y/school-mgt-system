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

export function ApplyCreditDialog({
  trigger,
  invoiceId,
  balance,
  creditBalance,
  onSaved,
}: {
  trigger: ReactElement;
  invoiceId: string;
  balance: number;
  creditBalance: number;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const maxApplicable = Math.min(balance, creditBalance);
  // Reset to the current max only when the dialog transitions to open —
  // adjusted during render, not an effect, per this codebase's established
  // pattern (and unlike record-payment-dialog.tsx's pre-existing bug, this
  // is fixed from the start rather than only on next reopen).
  const [wasOpen, setWasOpen] = useState(false);
  const [amount, setAmount] = useState(String(maxApplicable));
  if (open && !wasOpen) {
    setWasOpen(true);
    setAmount(String(maxApplicable));
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch(`/api/fee-invoices/${invoiceId}/apply-credit`, {
        method: "POST",
        body: JSON.stringify({ amount: Number(amount) }),
      });
      toast.success("Credit applied");
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to apply credit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Apply fee credit</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This student has {creditBalance} of unapplied fee credit. Applying it here records a payment on this
          invoice funded from that balance, not new cash received.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ac-amount">Amount to apply</Label>
            <Input
              id="ac-amount"
              type="number"
              min={0.01}
              max={maxApplicable}
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Applying…" : "Apply credit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
