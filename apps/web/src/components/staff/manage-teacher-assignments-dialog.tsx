"use client";

import { useEffect, useState } from "react";
import { GraduationCap, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { SchoolClass } from "@/components/academics/classes-tab";

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;

interface Section {
  id: string;
  name: string;
}

interface Assignment {
  id: string;
  classId: string;
  sectionId: string;
  class: { id: string; name: string };
  section: { id: string; name: string };
}

interface Subject {
  id: string;
  name: string;
  classId: string;
}

interface SubjectAssignment {
  id: string;
  subjectId: string;
  subject: Subject & { class: { id: string; name: string } };
}

interface StaffDetail {
  id: string;
  workingDays: (typeof DAYS)[number][];
  periodsAvailableFrom: number | null;
  periodsAvailableTo: number | null;
  maxPeriodsPerWeek: number | null;
}

export function ManageTeacherAssignmentsDialog({ staffId }: { staffId: string }) {
  const [open, setOpen] = useState(false);
  const {
    data: assignments,
    loading,
    refetch,
  } = useApi<Assignment[]>(open ? `/api/staff/${staffId}/assignments` : null);
  const { data: classes } = useApi<SchoolClass[]>(open ? "/api/classes" : null);

  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: sections } = useApi<Section[]>(
    classId ? `/api/sections?classId=${classId}` : null,
  );

  useEffect(() => {
    setSectionId("");
  }, [classId]);

  // Teaching capability — separate from the class/section attendance-scoping
  // above, since a teacher can be qualified to teach a subject without being
  // the one scoped to mark attendance for that section (and vice versa).
  const assignedClasses = Array.from(
    new Map((assignments ?? []).map((a) => [a.classId, a.class])).values(),
  );
  const {
    data: subjectAssignments,
    refetch: refetchSubjectAssignments,
  } = useApi<SubjectAssignment[]>(open ? `/api/staff/${staffId}/subject-assignments` : null);
  const [teachClassId, setTeachClassId] = useState("");
  const { data: teachSubjects } = useApi<Subject[]>(
    teachClassId ? `/api/subjects?classId=${teachClassId}` : null,
  );
  const [subjectId, setSubjectId] = useState("");
  const [subjectSubmitting, setSubjectSubmitting] = useState(false);

  const assignedSubjectIds = new Set((subjectAssignments ?? []).map((a) => a.subjectId));
  const availableSubjects = (teachSubjects ?? []).filter((s) => !assignedSubjectIds.has(s.id));

  useEffect(() => {
    setSubjectId("");
  }, [teachClassId]);

  const { data: staff, refetch: refetchStaff } = useApi<StaffDetail>(
    open ? `/api/staff/${staffId}` : null,
  );
  const [workingDays, setWorkingDays] = useState<string[]>([]);
  const [periodsFrom, setPeriodsFrom] = useState("");
  const [periodsTo, setPeriodsTo] = useState("");
  const [maxPerWeek, setMaxPerWeek] = useState("");
  const [availabilitySubmitting, setAvailabilitySubmitting] = useState(false);

  useEffect(() => {
    if (!staff) return;
    setWorkingDays(staff.workingDays);
    setPeriodsFrom(staff.periodsAvailableFrom != null ? String(staff.periodsAvailableFrom) : "");
    setPeriodsTo(staff.periodsAvailableTo != null ? String(staff.periodsAvailableTo) : "");
    setMaxPerWeek(staff.maxPeriodsPerWeek != null ? String(staff.maxPeriodsPerWeek) : "");
  }, [staff]);

  async function handleAdd() {
    if (!classId || !sectionId) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/staff/${staffId}/assignments`, {
        method: "POST",
        body: JSON.stringify({ classId, sectionId }),
      });
      toast.success("Assignment added");
      setSectionId("");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add assignment");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(assignmentSectionId: string) {
    try {
      await apiFetch(`/api/staff/${staffId}/assignments/${assignmentSectionId}`, {
        method: "DELETE",
      });
      toast.success("Assignment removed");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to remove assignment");
    }
  }

  async function handleAddSubject() {
    if (!subjectId) return;
    setSubjectSubmitting(true);
    try {
      await apiFetch(`/api/staff/${staffId}/subject-assignments`, {
        method: "POST",
        body: JSON.stringify({ subjectIds: [subjectId] }),
      });
      toast.success("Subject added");
      setSubjectId("");
      refetchSubjectAssignments();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add subject");
    } finally {
      setSubjectSubmitting(false);
    }
  }

  async function handleRemoveSubject(removeSubjectId: string) {
    try {
      await apiFetch(`/api/staff/${staffId}/subject-assignments/${removeSubjectId}`, {
        method: "DELETE",
      });
      toast.success("Subject removed");
      refetchSubjectAssignments();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to remove subject");
    }
  }

  function toggleDay(day: string) {
    setWorkingDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  async function handleSaveAvailability() {
    setAvailabilitySubmitting(true);
    try {
      await apiFetch(`/api/staff/${staffId}/availability`, {
        method: "PATCH",
        body: JSON.stringify({
          workingDays,
          periodsAvailableFrom: periodsFrom ? Number(periodsFrom) : null,
          periodsAvailableTo: periodsTo ? Number(periodsTo) : null,
          maxPeriodsPerWeek: maxPerWeek ? Number(maxPerWeek) : null,
        }),
      });
      toast.success("Availability saved");
      refetchStaff();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save availability");
    } finally {
      setAvailabilitySubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="ghost" title="Manage classes & teaching" />}>
        <GraduationCap className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage classes &amp; teaching</DialogTitle>
        </DialogHeader>

        <div className="flex max-h-[70vh] flex-col gap-6 overflow-y-auto pr-1">
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Classes &amp; sections (attendance scope)
            </p>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : !assignments || assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not assigned to any classes yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {assignments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <span className="font-medium">
                      {a.class.name} - {a.section.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemove(a.sectionId)}
                      aria-label="Remove assignment"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Select
                  items={(classes ?? []).map((c) => ({ value: c.id, label: c.name }))}
                  value={classId}
                  onValueChange={(v) => setClassId(v ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Class" />
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
              <div className="flex-1">
                <Select
                  items={(sections ?? []).map((s) => ({ value: s.id, label: s.name }))}
                  value={sectionId}
                  onValueChange={(v) => setSectionId(v ?? "")}
                  disabled={!classId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Section" />
                  </SelectTrigger>
                  <SelectContent>
                    {(sections ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" disabled={!classId || !sectionId || submitting} onClick={handleAdd}>
                <Plus className="size-4" />
                Add
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Subjects this teacher can teach
            </p>
            {!subjectAssignments || subjectAssignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No subjects assigned yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {subjectAssignments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <span className="font-medium">
                      {a.subject.name} — {a.subject.class.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSubject(a.subjectId)}
                      aria-label="Remove subject"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Select
                  items={assignedClasses.map((c) => ({ value: c.id, label: c.name }))}
                  value={teachClassId}
                  onValueChange={(v) => setTeachClassId(v ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Class" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignedClasses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Select
                  items={availableSubjects.map((s) => ({ value: s.id, label: s.name }))}
                  value={subjectId}
                  onValueChange={(v) => setSubjectId(v ?? "")}
                  disabled={!teachClassId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" disabled={!subjectId || subjectSubmitting} onClick={handleAddSubject}>
                <Plus className="size-4" />
                Add
              </Button>
            </div>
            {assignedClasses.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Assign a class/section above first — subjects are picked from those classes.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Timetable availability
            </p>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-normal">Working days</Label>
              <div className="flex flex-wrap gap-3">
                {DAYS.map((day) => (
                  <label key={day} className="flex items-center gap-1.5 text-sm">
                    <Checkbox checked={workingDays.includes(day)} onCheckedChange={() => toggleDay(day)} />
                    {day.slice(0, 3)}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="avail-from" className="text-sm font-normal">
                  Periods from
                </Label>
                <Input
                  id="avail-from"
                  type="number"
                  min={1}
                  value={periodsFrom}
                  onChange={(e) => setPeriodsFrom(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="avail-to" className="text-sm font-normal">
                  Periods to
                </Label>
                <Input
                  id="avail-to"
                  type="number"
                  min={1}
                  value={periodsTo}
                  onChange={(e) => setPeriodsTo(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="avail-max" className="text-sm font-normal">
                  Max/week
                </Label>
                <Input
                  id="avail-max"
                  type="number"
                  min={1}
                  value={maxPerWeek}
                  onChange={(e) => setMaxPerWeek(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Button size="sm" disabled={availabilitySubmitting} onClick={handleSaveAvailability}>
                {availabilitySubmitting ? "Saving…" : "Save availability"}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
