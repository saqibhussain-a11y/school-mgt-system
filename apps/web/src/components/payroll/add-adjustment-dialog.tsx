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

export function AddAdjustmentDialog({
  trigger,
  payslipId,
  onSaved,
}: {
  trigger: ReactElement;
  payslipId: string;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = Number(amount);
    if (!amount || Number.isNaN(parsed) || parsed === 0) {
      toast.error("Enter a non-zero amount");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch(`/api/payroll/${payslipId}/adjustments`, {
        method: "POST",
        body: JSON.stringify({ label, amount: parsed }),
      });
      toast.success("Adjustment added");
      setOpen(false);
      setLabel("");
      setAmount("");
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add adjustment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add adjustment</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Use a positive amount for an allowance or bonus, negative for a deduction (e.g. advance recovery).
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="aa-label">Label</Label>
            <Input
              id="aa-label"
              placeholder="e.g. Performance bonus"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="aa-amount">Amount</Label>
            <Input
              id="aa-amount"
              type="number"
              step="1"
              placeholder="5000 or -5000"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding…" : "Add adjustment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
