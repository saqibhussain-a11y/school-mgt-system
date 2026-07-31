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

export function EditDiscountDialog({
  trigger,
  invoiceId,
  amount,
  discountAmount,
  onSaved,
}: {
  trigger: ReactElement;
  invoiceId: string;
  amount: number;
  discountAmount: number;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(discountAmount));
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch(`/api/fee-invoices/${invoiceId}/discount`, {
        method: "PATCH",
        body: JSON.stringify({ discountAmount: Number(value) }),
      });
      toast.success("Discount updated");
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update discount");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit discount</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Invoice amount is {amount}. Covers sibling/staff-child discounts. Only possible before any payment is
          recorded.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ed-amount">Discount amount</Label>
            <Input
              id="ed-amount"
              type="number"
              min={0}
              max={amount}
              step="0.01"
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save discount"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
