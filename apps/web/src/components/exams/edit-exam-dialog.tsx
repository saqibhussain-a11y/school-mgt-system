"use client";

import { useEffect, useState, type FormEvent, type ReactElement } from "react";
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
import { toDateInputValue } from "@/lib/format";
import type { ExamSummary } from "@/components/exams/types";

export function EditExamDialog({
  trigger,
  exam,
  onSaved,
}: {
  trigger: ReactElement;
  exam: ExamSummary;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(exam.name);
  const [startDate, setStartDate] = useState(toDateInputValue(exam.startDate));
  const [endDate, setEndDate] = useState(toDateInputValue(exam.endDate));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(exam.name);
      setStartDate(toDateInputValue(exam.startDate));
      setEndDate(toDateInputValue(exam.endDate));
    }
  }, [open, exam]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch(`/api/exams/${exam.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, startDate, endDate }),
      });
      toast.success("Exam updated");
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update exam");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit exam</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-exam-name">Name</Label>
            <Input id="edit-exam-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-exam-start">Start date</Label>
              <Input
                id="edit-exam-start"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-exam-end">End date</Label>
              <Input
                id="edit-exam-end"
                type="date"
                required
                min={startDate || undefined}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
