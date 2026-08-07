"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch, ApiError } from "@/lib/api-client";
import { toDateInputValue } from "@/lib/format";
import type { DatesheetExamSubjectSummary } from "@/components/exams/types";

function GenerateDatesheetDialog({ examId, onGenerated }: { examId: string; onGenerated: () => void }) {
  const [open, setOpen] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");
  const [submitting, setSubmitting] = useState(false);

  async function handleGenerate() {
    setSubmitting(true);
    try {
      const result = await apiFetch<{ updatedCount: number; warnings: string[] }>(
        `/api/exams/${examId}/datesheet/generate`,
        { method: "POST", body: JSON.stringify({ startTime, endTime }) },
      );
      toast.success(`Scheduled ${result.updatedCount} paper(s)`);
      for (const w of result.warnings) toast.warning(w);
      setOpen(false);
      onGenerated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to generate datesheet");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Sparkles className="size-4" />
            Auto-generate
          </Button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Generate datesheet</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ds-start">Start time</Label>
            <Input id="ds-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ds-end">End time</Label>
            <Input id="ds-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Fills in subjects that don't have a date yet, walking forward one per working day. Subjects
          that already have a date are left alone.
        </p>
        <DialogFooter>
          <Button onClick={handleGenerate} disabled={submitting}>
            {submitting ? "Generating…" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DatesheetRow({
  subject,
  onSaved,
}: {
  subject: DatesheetExamSubjectSummary;
  onSaved: () => void;
}) {
  const [examDate, setExamDate] = useState(subject.examDate ? toDateInputValue(subject.examDate) : "");
  const [startTime, setStartTime] = useState(subject.startTime ?? "");
  const [endTime, setEndTime] = useState(subject.endTime ?? "");
  const [saving, setSaving] = useState(false);

  const dirty =
    examDate !== (subject.examDate ? toDateInputValue(subject.examDate) : "") ||
    startTime !== (subject.startTime ?? "") ||
    endTime !== (subject.endTime ?? "");

  async function handleSave() {
    if (!examDate || !startTime || !endTime) {
      toast.error("Date, start time, and end time are all required");
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/exam-subjects/${subject.id}/schedule`, {
        method: "PATCH",
        body: JSON.stringify({ examDate, startTime, endTime }),
      });
      toast.success("Schedule updated");
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update schedule");
    } finally {
      setSaving(false);
    }
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{subject.subject.name}</TableCell>
      <TableCell>{subject.maxMarks}</TableCell>
      <TableCell>
        <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className="w-40" />
      </TableCell>
      <TableCell>
        <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-28" />
      </TableCell>
      <TableCell>
        <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-28" />
      </TableCell>
      <TableCell>
        <Button size="sm" variant="outline" disabled={!dirty || saving} onClick={handleSave}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function DatesheetTab({
  examId,
  subjects,
  onChanged,
}: {
  examId: string;
  subjects: DatesheetExamSubjectSummary[];
  onChanged: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <GenerateDatesheetDialog examId={examId} onGenerated={onChanged} />
      </div>
      {subjects.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            This exam has no subjects yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Max marks</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.map((s) => (
                <DatesheetRow key={s.id} subject={s} onSaved={onChanged} />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
