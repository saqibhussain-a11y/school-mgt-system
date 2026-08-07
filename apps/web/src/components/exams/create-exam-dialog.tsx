"use client";

import { useEffect, useState, type FormEvent, type ReactElement } from "react";
import { Plus, Trash2 } from "lucide-react";
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
import type { AcademicSession } from "@/components/academics/sessions-tab";
import type { SchoolClass } from "@/components/academics/classes-tab";
import type { ExamSessionSummary } from "@/components/exam-sessions/exam-session-types";

interface SubjectOption {
  id: string;
  name: string;
}

interface SubjectRow {
  subjectId: string;
  maxMarks: string;
}

export function CreateExamDialog({
  trigger,
  onSaved,
}: {
  trigger: ReactElement;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [academicSessionId, setAcademicSessionId] = useState("");
  const [classId, setClassId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [examSessionId, setExamSessionId] = useState("");
  const [rows, setRows] = useState<SubjectRow[]>([{ subjectId: "", maxMarks: "100" }]);
  const [submitting, setSubmitting] = useState(false);

  const { data: sessions } = useApi<AcademicSession[]>(open ? "/api/academic-sessions" : null);
  const { data: classes } = useApi<SchoolClass[]>(
    open && academicSessionId ? `/api/classes?academicSessionId=${academicSessionId}` : null,
  );
  const { data: subjects } = useApi<SubjectOption[]>(
    open && classId ? `/api/subjects?classId=${classId}` : null,
  );
  const { data: examSessions } = useApi<ExamSessionSummary[]>(open ? "/api/exam-sessions" : null);

  useEffect(() => {
    if (open && !academicSessionId && sessions && sessions.length > 0) {
      setAcademicSessionId(sessions[0].id);
    }
  }, [open, sessions, academicSessionId]);

  useEffect(() => {
    setClassId("");
  }, [academicSessionId]);

  function updateRow(index: number, patch: Partial<SubjectRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function reset() {
    setName("");
    setStartDate("");
    setEndDate("");
    setExamSessionId("");
    setRows([{ subjectId: "", maxMarks: "100" }]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const validRows = rows.filter((r) => r.subjectId);
      if (validRows.length === 0) {
        toast.error("Add at least one subject");
        setSubmitting(false);
        return;
      }
      await apiFetch("/api/exams", {
        method: "POST",
        body: JSON.stringify({
          name,
          classId,
          academicSessionId,
          startDate,
          endDate,
          examSessionId: examSessionId || null,
          subjects: validRows.map((r) => ({ subjectId: r.subjectId, maxMarks: Number(r.maxMarks) })),
        }),
      });
      toast.success("Exam created");
      setOpen(false);
      reset();
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create exam");
    } finally {
      setSubmitting(false);
    }
  }

  const subjectOptions = (subjects ?? []).map((s) => ({ value: s.id, label: s.name }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New exam</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="exam-name">Name</Label>
            <Input
              id="exam-name"
              required
              placeholder="e.g. Midterm Exam"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Academic session</Label>
              <Select
                items={(sessions ?? []).map((s) => ({ value: s.id, label: s.name }))}
                value={academicSessionId}
                onValueChange={(v) => setAcademicSessionId(v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select session" />
                </SelectTrigger>
                <SelectContent>
                  {(sessions ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Class</Label>
              <Select
                items={(classes ?? []).map((c) => ({ value: c.id, label: c.name }))}
                value={classId}
                onValueChange={(v) => setClassId(v ?? "")}
                disabled={!academicSessionId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {(classes ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="exam-start">Start date</Label>
              <Input
                id="exam-start"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="exam-end">End date</Label>
              <Input
                id="exam-end"
                type="date"
                required
                min={startDate || undefined}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Combine with other classes (exam session)</Label>
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
            <p className="text-xs text-muted-foreground">
              Combining classes lets them share seating/invigilation for the same sitting. Leave as
              standalone unless you specifically need that.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Subjects</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!classId}
                onClick={() => setRows((prev) => [...prev, { subjectId: "", maxMarks: "100" }])}
              >
                <Plus className="size-3.5" />
                Add subject
              </Button>
            </div>
            {rows.map((row, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  <Select
                    items={subjectOptions}
                    value={row.subjectId}
                    onValueChange={(v) => updateRow(i, { subjectId: v ?? "" })}
                    disabled={!classId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjectOptions.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  className="w-24"
                  type="number"
                  min={1}
                  placeholder="Max marks"
                  value={row.maxMarks}
                  onChange={(e) => updateRow(i, { maxMarks: e.target.value })}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={rows.length === 1}
                  onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create exam"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
