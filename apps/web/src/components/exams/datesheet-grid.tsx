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
import { SyncSiblingsDialog, type PendingSync, type SiblingPreview } from "@/components/exams/sync-siblings-dialog";
import type { DatesheetExamSubjectSummary, ExamSummary } from "@/components/exams/types";

type ScheduledSubject = DatesheetExamSubjectSummary & {
  staleInvigilationWarning: string | null;
  syncedSiblings: { id: string; className: string; subjectName: string }[];
  skippedSiblings: { id: string; className: string; subjectName: string; reason: string }[];
};

function SubjectCard({
  subject,
  onRequestTimeChange,
  pendingSubjectId,
  resetNonce,
}: {
  subject: DatesheetExamSubjectSummary;
  onRequestTimeChange: (subject: DatesheetExamSubjectSummary, startTime: string, endTime: string) => void;
  pendingSubjectId: string | null;
  resetNonce: number;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: subject.id });
  const timeSignature = `${subject.startTime ?? ""}|${subject.endTime ?? ""}`;
  const [syncedSignature, setSyncedSignature] = useState(timeSignature);
  const [syncedResetNonce, setSyncedResetNonce] = useState(resetNonce);
  const [startTime, setStartTime] = useState(subject.startTime ?? "");
  const [endTime, setEndTime] = useState(subject.endTime ?? "");

  // A server-confirmed time change (drag reschedule, or this same card's own
  // save) must reset the inputs — adjusted during render rather than an
  // effect, so it can't lag a render behind or cause a redundant extra pass.
  if (timeSignature !== syncedSignature) {
    setSyncedSignature(timeSignature);
    setStartTime(subject.startTime ?? "");
    setEndTime(subject.endTime ?? "");
  }
  // A Cancel (or a failed save) on this card's pending sync dialog has no
  // server-confirmed prop change to reset from — `subject` itself never
  // changed — so the parent bumps resetNonce as a second, explicit trigger.
  // Without this, "Cancel" would leave the inputs at their unsaved values
  // and the Save button visible forever.
  if (resetNonce !== syncedResetNonce) {
    setSyncedResetNonce(resetNonce);
    setStartTime(subject.startTime ?? "");
    setEndTime(subject.endTime ?? "");
  }

  const dirty = startTime !== (subject.startTime ?? "") || endTime !== (subject.endTime ?? "");
  const pending = pendingSubjectId === subject.id;

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
                    disabled={pending || !startTime || !endTime}
                    onClick={() => onRequestTimeChange(subject, startTime, endTime)}
                  >
                    {pending ? "…" : "Save"}
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
  onRequestTimeChange,
  pendingSubjectId,
  resetNonce,
}: {
  day: string;
  subjects: DatesheetExamSubjectSummary[];
  onRequestTimeChange: (subject: DatesheetExamSubjectSummary, startTime: string, endTime: string) => void;
  pendingSubjectId: string | null;
  resetNonce: number;
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
          subjects.map((s) => (
            <SubjectCard
              key={s.id}
              subject={s}
              onRequestTimeChange={onRequestTimeChange}
              pendingSubjectId={pendingSubjectId}
              resetNonce={resetNonce}
            />
          ))
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
  const [pendingSync, setPendingSync] = useState<PendingSync | null>(null);
  const [committingSync, setCommittingSync] = useState(false);
  const [pendingTimeSubjectId, setPendingTimeSubjectId] = useState<string | null>(null);
  const [resetNonce, setResetNonce] = useState(0);
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

  function reportSyncResult(updated: ScheduledSubject) {
    if (updated.staleInvigilationWarning) toast.warning(updated.staleInvigilationWarning);
    if (updated.syncedSiblings.length > 0) {
      toast.info(`Also moved for ${updated.syncedSiblings.map((s) => s.className).join(", ")}.`);
    }
    for (const skipped of updated.skippedSiblings) {
      toast.warning(`${skipped.className}: ${skipped.reason}`);
    }
  }

  async function commitSchedule(
    subjectId: string,
    data: { examDate: string; startTime: string; endTime: string },
    syncSiblings: boolean,
  ): Promise<ScheduledSubject | null> {
    try {
      return await apiFetch<ScheduledSubject>(`/api/exam-subjects/${subjectId}/schedule`, {
        method: "PATCH",
        body: JSON.stringify({ ...data, syncSiblings }),
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update schedule");
      return null;
    }
  }

  // A failed preview shouldn't block the edit — fall through to a
  // single-class move, same as a non-session exam would get.
  async function fetchSiblingPreview(subjectId: string, examDate: string, startTime: string, endTime: string) {
    try {
      const qs = new URLSearchParams({ examDate, startTime, endTime }).toString();
      return await apiFetch<SiblingPreview>(`/api/exam-subjects/${subjectId}/schedule-siblings?${qs}`);
    } catch {
      return { movable: [], skipped: [] } as SiblingPreview;
    }
  }

  async function moveScheduled(subject: DatesheetExamSubjectSummary, targetDate: string, syncSiblings: boolean) {
    const previous = subjects;
    setSubjects((prev) => prev.map((s) => (s.id === subject.id ? { ...s, examDate: targetDate } : s)));
    const updated = await commitSchedule(
      subject.id,
      { examDate: targetDate, startTime: subject.startTime!, endTime: subject.endTime! },
      syncSiblings,
    );
    if (!updated) {
      // Revert to the last-known-good position, not a recomputed guess — the
      // server is the only source of truth for what actually landed.
      setSubjects(previous);
      return;
    }
    setSubjects((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    toast.success(`${subject.subject.name} moved to ${fullDateLabel(targetDate)}`);
    reportSyncResult(updated);
  }

  async function saveTime(subject: DatesheetExamSubjectSummary, startTime: string, endTime: string, syncSiblings: boolean) {
    setPendingTimeSubjectId(subject.id);
    const updated = await commitSchedule(
      subject.id,
      { examDate: toDateInputValue(subject.examDate!), startTime, endTime },
      syncSiblings,
    );
    setPendingTimeSubjectId(null);
    if (!updated) {
      setResetNonce((n) => n + 1);
      return;
    }
    applyUpdate(updated);
    toast.success("Time updated");
    reportSyncResult(updated);
  }

  // Shared by drag (date changes) and the inline time editor (time changes,
  // same date) — both edit an already-scheduled subject, exactly the
  // situation that can desync a session. A subject with no session, or one
  // where no linked class currently shares its old date, gets zero preview
  // round-trip and moves immediately — today's exact frictionless behavior.
  async function requestScheduleChange(
    kind: "move" | "time",
    subject: DatesheetExamSubjectSummary,
    examDate: string,
    startTime: string,
    endTime: string,
  ) {
    if (!exam.examSession) {
      if (kind === "move") void moveScheduled(subject, examDate, false);
      else void saveTime(subject, startTime, endTime, false);
      return;
    }
    const preview = await fetchSiblingPreview(subject.id, examDate, startTime, endTime);
    if (preview.movable.length === 0 && preview.skipped.length === 0) {
      if (kind === "move") void moveScheduled(subject, examDate, false);
      else void saveTime(subject, startTime, endTime, false);
      return;
    }
    setPendingSync({ subjectId: subject.id, subjectName: subject.subject.name, kind, examDate, startTime, endTime, preview });
  }

  async function resolvePendingSync(choice: "all" | "just-this" | "cancel") {
    if (!pendingSync) return;
    const { kind, subjectId, examDate, startTime, endTime } = pendingSync;
    setPendingSync(null);
    if (choice === "cancel") {
      setResetNonce((n) => n + 1);
      return;
    }
    const subject = subjects.find((s) => s.id === subjectId);
    if (!subject) return;
    setCommittingSync(true);
    if (kind === "move") await moveScheduled(subject, examDate, choice === "all");
    else await saveTime(subject, startTime, endTime, choice === "all");
    setCommittingSync(false);
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
      void requestScheduleChange("move", subject, targetDate, subject.startTime, subject.endTime);
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
          Moving an already-scheduled paper here will offer to move it for linked classes sharing that day too.
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
                    <SubjectCard
                      subject={s}
                      onRequestTimeChange={() => {}}
                      pendingSubjectId={pendingTimeSubjectId}
                      resetNonce={resetNonce}
                    />
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
                  <DayColumn
                    key={day}
                    day={day}
                    subjects={byDate.get(day) ?? []}
                    onRequestTimeChange={(subject, startTime, endTime) =>
                      void requestScheduleChange("time", subject, toDateInputValue(subject.examDate!), startTime, endTime)
                    }
                    pendingSubjectId={pendingTimeSubjectId}
                    resetNonce={resetNonce}
                  />
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

      <SyncSiblingsDialog pending={pendingSync} onResolve={resolvePendingSync} resolving={committingSync} />
    </div>
  );
}
