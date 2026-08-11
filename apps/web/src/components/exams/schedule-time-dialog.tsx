"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch, ApiError } from "@/lib/api-client";
import { fullDateLabel } from "@/components/exams/datesheet-date-utils";
import type { DatesheetExamSubjectSummary } from "@/components/exams/types";

export interface PendingSchedule {
  subjectId: string;
  subjectName: string;
  targetDate: string;
}

type ScheduledSubject = DatesheetExamSubjectSummary & {
  staleInvigilationWarning: string | null;
  syncedSiblings: { id: string; className: string; subjectName: string }[];
  skippedSiblings: { id: string; className: string; subjectName: string; reason: string }[];
};

// A subject dropped straight out of the Unscheduled lane has no time block
// yet, so the drop can't just PATCH a guessed 09:00–12:00 — this dialog asks
// once, up front, instead of silently inventing a time that later flows
// straight into invigilation generation.
export function ScheduleTimeDialog({
  pending,
  onOpenChange,
  onScheduled,
}: {
  pending: PendingSchedule | null;
  onOpenChange: (open: boolean) => void;
  onScheduled: (updated: ScheduledSubject) => void;
}) {
  const [syncedSubjectId, setSyncedSubjectId] = useState(pending?.subjectId ?? null);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");
  const [submitting, setSubmitting] = useState(false);

  // Reset to the defaults only when a *different* subject becomes pending —
  // adjusted during render rather than an effect, per
  // https://react.dev/learn/you-might-not-need-an-effect. Guarding on
  // pending's identity (not just truthiness) means a re-render while the
  // same subject is still pending never clobbers an in-progress edit.
  if (pending && pending.subjectId !== syncedSubjectId) {
    setSyncedSubjectId(pending.subjectId);
    setStartTime("09:00");
    setEndTime("12:00");
  }

  async function handleConfirm() {
    if (!pending) return;
    setSubmitting(true);
    try {
      const updated = await apiFetch<ScheduledSubject>(`/api/exam-subjects/${pending.subjectId}/schedule`, {
        method: "PATCH",
        body: JSON.stringify({ examDate: pending.targetDate, startTime, endTime }),
      });
      toast.success(`${pending.subjectName} scheduled`);
      if (updated.staleInvigilationWarning) toast.warning(updated.staleInvigilationWarning);
      onScheduled(updated);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to schedule paper");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={!!pending} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Schedule {pending?.subjectName}</DialogTitle>
        </DialogHeader>
        {pending && (
          <>
            <p className="text-sm text-muted-foreground">
              Date: <span className="font-medium text-foreground">{fullDateLabel(pending.targetDate)}</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="sched-start">Start time</Label>
                <Input
                  id="sched-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="sched-end">End time</Label>
                <Input id="sched-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
          </>
        )}
        <DialogFooter>
          <Button onClick={handleConfirm} disabled={submitting}>
            {submitting ? "Scheduling…" : "Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
