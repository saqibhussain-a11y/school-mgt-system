"use client";

import { useState, type ReactElement } from "react";
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

export function BulkGenerateScheduleDialog({
  trigger,
  chapterId,
  mode,
  onGenerated,
}: {
  trigger: ReactElement;
  chapterId: string;
  mode: "REPEAT_WEEKLY" | "SPLIT_DAYS";
  onGenerated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [count, setCount] = useState(mode === "REPEAT_WEEKLY" ? "4" : "5");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!startDate || !count) return;
    setSubmitting(true);
    try {
      await apiFetch("/api/schedule-entries/bulk-generate", {
        method: "POST",
        body: JSON.stringify({ chapterId, mode, startDate, count: Number(count) }),
      });
      toast.success(
        mode === "REPEAT_WEEKLY"
          ? `Spread across ${count} weeks`
          : `Split into ${count} days`,
      );
      setOpen(false);
      onGenerated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to generate schedule");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {mode === "REPEAT_WEEKLY" ? "Repeat this chapter across weeks" : "Split this chapter into days"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="text-xs text-muted-foreground">
            {mode === "REPEAT_WEEKLY"
              ? "Creates one week-long schedule entry per week, back to back, starting from the date below."
              : "Creates one single-day schedule entry per day, starting from the date below."}
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bulk-start">Start date</Label>
            <Input
              id="bulk-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bulk-count">{mode === "REPEAT_WEEKLY" ? "Number of weeks" : "Number of days"}</Label>
            <Input
              id="bulk-count"
              type="number"
              min={1}
              max={52}
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" disabled={submitting || !startDate} onClick={handleSubmit}>
            {submitting ? "Generating…" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
