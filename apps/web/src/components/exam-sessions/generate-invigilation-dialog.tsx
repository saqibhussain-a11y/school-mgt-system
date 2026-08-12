"use client";

import { useState, type ReactElement } from "react";
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

export function GenerateInvigilationDialog({
  trigger,
  examSessionId,
  onGenerated,
}: {
  trigger: ReactElement;
  examSessionId: string;
  onGenerated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [invigilatorsPerRoom, setInvigilatorsPerRoom] = useState("1");
  const [ignoreRegularTimetableConflicts, setIgnoreRegularTimetableConflicts] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleGenerate() {
    setSubmitting(true);
    try {
      const result = await apiFetch<{ createdCount: number; warnings: string[] }>(
        `/api/exam-sessions/${examSessionId}/invigilation/generate`,
        {
          method: "POST",
          body: JSON.stringify({
            invigilatorsPerRoom: Number(invigilatorsPerRoom) || 1,
            ignoreRegularTimetableConflicts,
          }),
        },
      );
      toast.success(`Assigned ${result.createdCount} invigilation duty(ies)`);
      for (const w of result.warnings) toast.warning(w);
      setOpen(false);
      onGenerated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to generate invigilation roster");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate invigilation roster</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="invigilators-per-room">Invigilators per room</Label>
            <Input
              id="invigilators-per-room"
              type="number"
              min={1}
              value={invigilatorsPerRoom}
              onChange={(e) => setInvigilatorsPerRoom(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={ignoreRegularTimetableConflicts}
              onCheckedChange={(v) => setIgnoreRegularTimetableConflicts(v === true)}
            />
            Ignore regular timetable conflicts (use if this school suspends normal classes during exams)
          </label>
          <p className="text-xs text-muted-foreground">
            Requires seating to already be generated, and every linked exam&apos;s datesheet to be
            complete.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={handleGenerate} disabled={submitting}>
            {submitting ? "Generating…" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
