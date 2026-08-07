"use client";

import { useEffect, useState, type FormEvent, type ReactElement } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import { toDateInputValue } from "@/lib/format";
import type { ExamSummary } from "@/components/exams/types";
import type { ExamSessionSummary } from "@/components/exam-sessions/exam-session-types";

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
  const [examSessionId, setExamSessionId] = useState(exam.examSessionId ?? "");
  const [submitting, setSubmitting] = useState(false);

  const { data: examSessions } = useApi<ExamSessionSummary[]>(open ? "/api/exam-sessions" : null);

  useEffect(() => {
    if (open) {
      setName(exam.name);
      setStartDate(toDateInputValue(exam.startDate));
      setEndDate(toDateInputValue(exam.endDate));
      setExamSessionId(exam.examSessionId ?? "");
    }
  }, [open, exam]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch(`/api/exams/${exam.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, startDate, endDate, examSessionId: examSessionId || null }),
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
          <div className="flex flex-col gap-2">
            <Label>Exam session</Label>
            <Select
              items={[
                { value: "", label: "None — standalone exam" },
                ...(examSessions ?? []).map((s) => ({ value: s.id, label: s.name })),
              ]}
              value={examSessionId}
              onValueChange={(v) => setExamSessionId(v ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="None — standalone exam" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None — standalone exam</SelectItem>
                {(examSessions ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
