"use client";

import { useState, type FormEvent, type ReactElement } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { Period } from "./room-types";

export function PeriodDialog({
  trigger,
  period,
  onSaved,
}: {
  trigger: ReactElement;
  period?: Period;
  onSaved: () => void;
}) {
  const isEdit = Boolean(period);
  const [open, setOpen] = useState(false);
  const [periodNumber, setPeriodNumber] = useState(period ? String(period.periodNumber) : "");
  const [startTime, setStartTime] = useState(period?.startTime ?? "");
  const [endTime, setEndTime] = useState(period?.endTime ?? "");
  const [isBreak, setIsBreak] = useState(period?.isBreak ?? false);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setPeriodNumber("");
    setStartTime("");
    setEndTime("");
    setIsBreak(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body = { periodNumber: Number(periodNumber), startTime, endTime, isBreak };
      if (isEdit) {
        await apiFetch(`/api/periods/${period!.id}`, { method: "PATCH", body: JSON.stringify(body) });
        toast.success("Period updated");
      } else {
        await apiFetch("/api/periods", { method: "POST", body: JSON.stringify(body) });
        toast.success("Period added");
        reset();
      }
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save period");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit period" : "Add period"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="period-number">Period number</Label>
            <Input
              id="period-number"
              type="number"
              min={1}
              required
              value={periodNumber}
              onChange={(e) => setPeriodNumber(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="period-start">Start time</Label>
              <Input
                id="period-start"
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="period-end">End time</Label>
              <Input
                id="period-end"
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={isBreak} onCheckedChange={(v) => setIsBreak(v === true)} />
            This is a break/lunch period (never scheduled into)
          </label>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Add period"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
