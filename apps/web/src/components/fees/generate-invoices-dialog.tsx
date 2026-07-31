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
import type { FeeStructure } from "./types";

export function GenerateInvoicesDialog({
  trigger,
  structure,
  onSaved,
}: {
  trigger: ReactElement;
  structure: FeeStructure;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await apiFetch<{ created: number; skipped: number }>("/api/fee-invoices/generate", {
        method: "POST",
        body: JSON.stringify({ feeStructureId: structure.id, period, dueDate }),
      });
      toast.success(
        `${result.created} invoice${result.created === 1 ? "" : "s"} generated` +
          (result.skipped ? ` (${result.skipped} already invoiced for this period)` : ""),
      );
      setOpen(false);
      setPeriod("");
      setDueDate("");
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to generate invoices");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate invoices</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Creates a {structure.category} invoice of {structure.amount} for every active student in{" "}
          {structure.class.name}.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="gi-period">Period</Label>
            <Input
              id="gi-period"
              placeholder="e.g. September 2026"
              required
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="gi-due">Due date</Label>
            <Input
              id="gi-due"
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Generating…" : "Generate invoices"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
