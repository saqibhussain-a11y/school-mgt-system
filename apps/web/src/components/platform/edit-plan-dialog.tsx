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
import { platformApiFetch } from "@/lib/platform-api-client";
import { ApiError } from "@/lib/api-client";
import type { Plan } from "./types";

export function EditPlanDialog({
  plan,
  trigger,
  onSaved,
}: {
  plan: Plan;
  trigger: ReactElement;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(plan.label);
  const [priceMonthly, setPriceMonthly] = useState(String(plan.priceMonthly));
  const [maxStudents, setMaxStudents] = useState(String(plan.maxStudents));
  const [maxStaff, setMaxStaff] = useState(String(plan.maxStaff));
  const [submitting, setSubmitting] = useState(false);

  function resetToPlan() {
    setLabel(plan.label);
    setPriceMonthly(String(plan.priceMonthly));
    setMaxStudents(String(plan.maxStudents));
    setMaxStaff(String(plan.maxStaff));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await platformApiFetch(`/api/platform/plans/${plan.key}`, {
        method: "PATCH",
        body: JSON.stringify({
          label,
          priceMonthly: Number(priceMonthly),
          maxStudents: Number(maxStudents),
          maxStaff: Number(maxStaff),
        }),
      });
      toast.success(`${label} plan updated`);
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update plan");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetToPlan();
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {plan.label} plan</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Changes apply immediately across the platform. A school already over a lowered limit keeps its existing
          students/staff — it just can&apos;t add more until it&apos;s back under the new cap.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="plan-label">Plan name</Label>
            <Input id="plan-label" required value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="plan-price">Price / month</Label>
              <Input
                id="plan-price"
                type="number"
                min={0}
                step="1"
                required
                value={priceMonthly}
                onChange={(e) => setPriceMonthly(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="plan-max-students">Max students</Label>
              <Input
                id="plan-max-students"
                type="number"
                min={1}
                step="1"
                required
                value={maxStudents}
                onChange={(e) => setMaxStudents(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="plan-max-staff">Max staff</Label>
              <Input
                id="plan-max-staff"
                type="number"
                min={1}
                step="1"
                required
                value={maxStaff}
                onChange={(e) => setMaxStaff(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
