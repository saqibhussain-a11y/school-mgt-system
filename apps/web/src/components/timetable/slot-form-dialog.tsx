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
import type { TimetableSlotSummary } from "@/components/timetable/timetable-grid";

const DAYS = [
  { value: "MONDAY", label: "Monday" },
  { value: "TUESDAY", label: "Tuesday" },
  { value: "WEDNESDAY", label: "Wednesday" },
  { value: "THURSDAY", label: "Thursday" },
  { value: "FRIDAY", label: "Friday" },
  { value: "SATURDAY", label: "Saturday" },
];

interface SubjectOption {
  id: string;
  name: string;
}

interface TeacherAssignmentOption {
  staffId: string;
  staff: { user: { firstName: string; lastName: string } };
}

export function SlotFormDialog({
  trigger,
  classId,
  sectionId,
  slot,
  onSaved,
}: {
  trigger: ReactElement;
  classId: string;
  sectionId: string;
  slot?: TimetableSlotSummary;
  onSaved: () => void;
}) {
  const isEdit = Boolean(slot);
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("MONDAY");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("09:45");
  const [submitting, setSubmitting] = useState(false);

  const { data: subjects } = useApi<SubjectOption[]>(open ? `/api/subjects?classId=${classId}` : null);
  const { data: teacherAssignments } = useApi<TeacherAssignmentOption[]>(
    open ? `/api/sections/${sectionId}/teachers` : null,
  );

  useEffect(() => {
    if (!open) return;
    setSubjectId(slot?.subject.id ?? "");
    setStaffId(slot?.staff.id ?? "");
    setDayOfWeek(slot?.dayOfWeek ?? "MONDAY");
    setStartTime(slot?.startTime ?? "09:00");
    setEndTime(slot?.endTime ?? "09:45");
  }, [open, slot]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body = { classId, sectionId, subjectId, staffId, dayOfWeek, startTime, endTime };
      if (isEdit && slot) {
        await apiFetch(`/api/timetable-slots/${slot.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        toast.success("Timetable slot updated");
      } else {
        await apiFetch("/api/timetable-slots", { method: "POST", body: JSON.stringify(body) });
        toast.success("Timetable slot added");
      }
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save timetable slot");
    } finally {
      setSubmitting(false);
    }
  }

  const teacherOptions = (teacherAssignments ?? []).map((a) => ({
    value: a.staffId,
    label: `${a.staff.user.firstName} ${a.staff.user.lastName}`,
  }));
  const subjectOptions = (subjects ?? []).map((s) => ({ value: s.id, label: s.name }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit timetable slot" : "Add timetable slot"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Subject</Label>
            <Select
              items={subjectOptions}
              value={subjectId}
              onValueChange={(v) => setSubjectId(v ?? "")}
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
          <div className="flex flex-col gap-2">
            <Label>Teacher</Label>
            <Select
              items={teacherOptions}
              value={staffId}
              onValueChange={(v) => setStaffId(v ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select teacher" />
              </SelectTrigger>
              <SelectContent>
                {teacherOptions.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {teacherOptions.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No teachers are assigned to this class/section yet — assign one from the Staff page
                first.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label>Day</Label>
            <Select
              items={DAYS}
              value={dayOfWeek}
              onValueChange={(v) => setDayOfWeek(v ?? "MONDAY")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ts-start">Start time</Label>
              <Input
                id="ts-start"
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ts-end">End time</Label>
              <Input
                id="ts-end"
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting || !subjectId || !staffId}>
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Add slot"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
