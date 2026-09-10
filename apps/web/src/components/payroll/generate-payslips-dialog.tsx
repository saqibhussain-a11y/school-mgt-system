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

export function GeneratePayslipsDialog({ trigger, onSaved }: { trigger: ReactElement; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await apiFetch<{ generated: number; skipped: number }>("/api/payroll/generate", {
        method: "POST",
        body: JSON.stringify({ period }),
      });
      toast.success(
        `${result.generated} payslip${result.generated === 1 ? "" : "s"} generated` +
          (result.skipped ? ` (${result.skipped} staff skipped — no salary set, or already generated)` : ""),
      );
      setOpen(false);
      setPeriod("");
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to generate payslips");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate payslips</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Creates a payslip for every active staff member with a base salary set, for the month you pick.
          Unpaid leave approved within that month is deducted automatically.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="gp-period">Month</Label>
            <Input id="gp-period" type="month" required value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Generating…" : "Generate payslips"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
