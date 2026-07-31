"use client";

import { useEffect, useState, type FormEvent, type ReactElement } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiFetch, ApiError } from "@/lib/api-client";
import { SubmissionStatusView } from "@/components/assignments/submission-status-view";

export function GradeSubmissionDialog({
  trigger,
  assignmentId,
  studentId,
  studentName,
  maxMarks,
  currentMarks,
  currentFeedback,
  onGraded,
}: {
  trigger: ReactElement;
  assignmentId: string;
  studentId: string;
  studentName: string;
  maxMarks: number;
  currentMarks: number | null;
  currentFeedback: string | null;
  onGraded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [marksObtained, setMarksObtained] = useState(currentMarks !== null ? String(currentMarks) : "");
  const [feedback, setFeedback] = useState(currentFeedback ?? "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setMarksObtained(currentMarks !== null ? String(currentMarks) : "");
      setFeedback(currentFeedback ?? "");
    }
  }, [open, currentMarks, currentFeedback]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch(`/api/assignments/${assignmentId}/submissions/${studentId}/grade`, {
        method: "PATCH",
        body: JSON.stringify({
          marksObtained: marksObtained === "" ? null : Number(marksObtained),
          feedback: feedback || undefined,
        }),
      });
      toast.success("Grade saved");
      setOpen(false);
      onGraded();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save grade");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Grade {studentName}&apos;s submission</DialogTitle>
        </DialogHeader>
        {open && <SubmissionStatusView assignmentId={assignmentId} studentId={studentId} maxMarks={maxMarks} />}
        <Separator />
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="grade-marks">Marks obtained (out of {maxMarks})</Label>
            <Input
              id="grade-marks"
              type="number"
              min={0}
              max={maxMarks}
              value={marksObtained}
              onChange={(e) => setMarksObtained(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="grade-feedback">Feedback</Label>
            <Textarea
              id="grade-feedback"
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save grade"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
