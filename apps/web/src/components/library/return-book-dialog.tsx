"use client";

import { useState, type ReactElement } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { BookLoan } from "./types";
import { FINE_PER_DAY } from "./types";

function daysLate(dueDate: string) {
  const diff = Date.now() - new Date(dueDate).getTime();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

export function ReturnBookDialog({
  trigger,
  loan,
  onReturned,
}: {
  trigger: ReactElement;
  loan: BookLoan;
  onReturned: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [lost, setLost] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const late = daysLate(loan.dueDate);
  const estimatedFine = Math.round(late * FINE_PER_DAY * 100) / 100;

  async function handleReturn() {
    setSubmitting(true);
    try {
      await apiFetch(`/api/book-loans/${loan.id}/return`, { method: "POST", body: JSON.stringify({ lost }) });
      toast.success(lost ? "Book marked as lost" : "Book returned");
      setOpen(false);
      setLost(false);
      onReturned();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to record return");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Return &quot;{loan.book.title}&quot;</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {late > 0 && !lost && (
            <p className="text-sm text-muted-foreground">
              {late} day{late === 1 ? "" : "s"} overdue — estimated fine: {estimatedFine}
            </p>
          )}
          <div className="flex items-center gap-2">
            <Checkbox id="rb-lost" checked={lost} onCheckedChange={(c) => setLost(c === true)} />
            <Label htmlFor="rb-lost" className="font-normal">
              Mark as lost instead of returned
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleReturn} disabled={submitting}>
            {submitting ? "Saving…" : lost ? "Mark as lost" : "Confirm return"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
