"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiError } from "@/lib/api-client";
import { toDateInputValue } from "@/lib/format";
import { cn } from "@/lib/utils";
import { buildWeeks, dayLabel, fullDateLabel, weekLabel } from "@/components/exams/datesheet-date-utils";
import { ScheduleTimeDialog, type PendingSchedule } from "@/components/exams/schedule-time-dialog";
import type { DatesheetExamSubjectSummary, ExamSummary } from "@/components/exams/types";

type ScheduledSubject = DatesheetExamSubjectSummary & { staleInvigilationWarning: string | null };

function SubjectCard({
  subject,
  onTimeSaved,
}: {
  subject: DatesheetExamSubjectSummary;
  onTimeSaved: (updated: ScheduledSubject) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: subject.id });
  const timeSignature = `${subject.startTime ?? ""}|${subject.endTime ?? ""}`;
  const [syncedSignature, setSyncedSignature] = useState(timeSignature);
  const [startTime, setStartTime] = useState(subject.startTime ?? "");
  const [endTime, setEndTime] = useState(subject.endTime ?? "");
  const [saving, setSaving] = useState(false);

  // A server-confirmed time change (drag reschedule, or this same card's own
  // save) must reset the inputs — adjusted during render rather than an
  // effect, so it can't lag a render behind or cause a redundant extra pass.
  if (timeSignature !== syncedSignature) {
    setSyncedSignature(timeSignature);
    setStartTime(subject.startTime ?? "");
    setEndTime(subject.endTime ?? "");
  }

  const dirty = startTime !== (subject.startTime ?? "") || endTime !== (subject.endTime ?? "");

  async function handleSaveTime() {
    if (!subject.examDate || !startTime || !endTime) return;
    setSaving(true);
    try {
      const updated = await apiFetch<ScheduledSubject>(`/api/exam-subjects/${subject.id}/schedule`, {
        method: "PATCH",
        body: JSON.stringify({ examDate: subject.examDate, startTime, endTime }),
      });
      toast.success("Time updated");
      if (updated.staleInvigilationWarning) toast.warning(updated.staleInvigilationWarning);
      onTimeSaved(updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update time");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn(isDragging && "z-10 opacity-60")}
    >
      <Card className="gap-2 p-3">
        <div className="flex items-start gap-2">
          <button
            type="button"
            aria-label={`Drag ${subject.subject.name} to reschedule`}
            className="mt-0.5 shrink-0 touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{subject.subject.name}</div>
            <div className="text-xs text-muted-foreground">{subject.maxMarks} marks</div>
            {subject.examDate && (
              <div className="mt-2 flex items-center gap-1">
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="h-7 w-[6.5rem] px-1 text-xs"
                />
                <span className="text-xs text-muted-foreground">–</span>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="h-7 w-[6.5rem] px-1 text-xs"
                />
                {dirty && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    disabled={saving || !startTime || !endTime}
                    onClick={handleSaveTime}
                  >
                    {saving ? "…" : "Save"}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function DayColumn({
  day,
  subjects,
  onTimeSaved,
}: {
  day: string;
  subjects: DatesheetExamSubjectSummary[];
  onTimeSaved: (updated: ScheduledSubject) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: day });
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-semibold text-muted-foreground">{dayLabel(day)}</div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-16 flex-col gap-2 rounded-lg p-1 transition-colors",
          isOver && "bg-accent/60 ring-2 ring-primary/40",
        )}
      >
        {subjects.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-2 text-center text-xs text-muted-foreground">
            No paper
          </div>
        ) : (
          subjects.map((s) => <SubjectCard key={s.id} subject={s} onTimeSaved={onTimeSaved} />)
        )}
      </div>
    </div>
  );
}

// Deliberately doesn't call the page-level onChanged/refetch after a drag,
// time-save, or schedule-dialog confirm — this page's loading skeleton
// unmounts the (uncontrolled) Tabs on every refetch, which would snap the
// user back to "Marks entry" after every single drag. The PATCH response is
// already the reconciled source of truth for local state, so a full-page
// refetch buys nothing here; "Auto-generate" still refetches since it's a
// deliberate bulk action, not a rapid micro-interaction.
export function DatesheetGrid({ exam }: { exam: ExamSummary }) {
  const [subjects, setSubjects] = useState(exam.examSubjects);
  const [pendingSchedule, setPendingSchedule] = useState<PendingSchedule | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // A refetch from outside this grid (e.g. "Auto-generate") replaces
  // exam.examSubjects wholesale — adjusted during render rather than an
  // effect, per https://react.dev/learn/you-might-not-need-an-effect.
  const [syncedExamSubjects, setSyncedExamSubjects] = useState(exam.examSubjects);
  if (exam.examSubjects !== syncedExamSubjects) {
    setSyncedExamSubjects(exam.examSubjects);
    setSubjects(exam.examSubjects);
  }

  const rangeStart = exam.examSession?.startDate ?? exam.startDate;
  const rangeEnd = exam.examSession?.endDate ?? exam.endDate;
  const weeks = useMemo(() => buildWeeks(rangeStart, rangeEnd), [rangeStart, rangeEnd]);

  const unscheduled = subjects.filter((s) => !s.examDate);
  const byDate = new Map<string, DatesheetExamSubjectSummary[]>();
  for (const s of subjects) {
    if (!s.examDate) continue;
    const key = toDateInputValue(s.examDate);
    (byDate.get(key) ?? byDate.set(key, []).get(key)!).push(s);
  }

  function applyUpdate(updated: ScheduledSubject) {
    setSubjects((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  async function moveScheduled(subject: DatesheetExamSubjectSummary, targetDate: string) {
    const previous = subjects;
    setSubjects((prev) => prev.map((s) => (s.id === subject.id ? { ...s, examDate: targetDate } : s)));
    try {
      const updated = await apiFetch<ScheduledSubject>(`/api/exam-subjects/${subject.id}/schedule`, {
        method: "PATCH",
        body: JSON.stringify({ examDate: targetDate, startTime: subject.startTime, endTime: subject.endTime }),
      });
      setSubjects((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      toast.success(`${subject.subject.name} moved to ${fullDateLabel(targetDate)}`);
      if (updated.staleInvigilationWarning) toast.warning(updated.staleInvigilationWarning);
    } catch (err) {
      // Revert to the last-known-good position, not a recomputed guess — the
      // server is the only source of truth for what actually landed.
      setSubjects(previous);
      toast.error(err instanceof ApiError ? err.message : "Failed to move paper");
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const targetDate = event.over ? String(event.over.id) : null;
    if (!targetDate) return;

    const subjectId = String(event.active.id);
    const subject = subjects.find((s) => s.id === subjectId);
    if (!subject) return;
    if (subject.examDate && toDateInputValue(subject.examDate) === targetDate) return;

    const conflict = subjects.find(
      (s) => s.id !== subjectId && s.examDate && toDateInputValue(s.examDate) === targetDate,
    );
    if (conflict) {
      toast.error(`${conflict.subject.name} is already scheduled on ${fullDateLabel(targetDate)}`);
      return;
    }

    if (subject.startTime && subject.endTime) {
      void moveScheduled(subject, targetDate);
    } else {
      setPendingSchedule({ subjectId: subject.id, subjectName: subject.subject.name, targetDate });
    }
  }

  const siblingClasses = exam.examSession?.exams.filter((e) => e.id !== exam.id).map((e) => e.class.name) ?? [];

  return (
    <div className="flex flex-col gap-6">
      {exam.examSession && (
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Part of exam session{" "}
          <span className="font-medium text-foreground">&quot;{exam.examSession.name}&quot;</span>
          {siblingClasses.length > 0 ? (
            <> — combined with {siblingClasses.join(", ")} for shared seating.</>
          ) : (
            <>.</>
          )}{" "}
          Dragging papers here doesn&apos;t move their schedules.
        </div>
      )}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex flex-col gap-6">
          {unscheduled.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="text-sm font-semibold text-muted-foreground">Unscheduled papers</div>
              <div className="flex flex-wrap gap-2">
                {unscheduled.map((s) => (
                  <div key={s.id} className="w-56">
                    <SubjectCard subject={s} onTimeSaved={applyUpdate} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {weeks.map((week) => (
            <div key={week.mondayKey} className="flex flex-col gap-2">
              <div className="text-sm font-semibold text-muted-foreground">{weekLabel(week.mondayKey)}</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {week.days.map((day) => (
                  <DayColumn key={day} day={day} subjects={byDate.get(day) ?? []} onTimeSaved={applyUpdate} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </DndContext>

      <ScheduleTimeDialog
        pending={pendingSchedule}
        onOpenChange={(open) => !open && setPendingSchedule(null)}
        onScheduled={(updated) => {
          applyUpdate(updated);
          setPendingSchedule(null);
        }}
      />
    </div>
  );
}
