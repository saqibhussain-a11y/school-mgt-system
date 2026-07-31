"use client";

import { useEffect, useState, type FormEvent, type ReactElement } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { SchoolClass } from "@/components/academics/classes-tab";

interface SubjectOption {
  id: string;
  name: string;
}

interface TeacherAssignmentRow {
  classId: string;
  class: { id: string; name: string };
}

export function CreateAssignmentDialog({
  trigger,
  onSaved,
}: {
  trigger: ReactElement;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const isTeacher = user?.role === "TEACHER";
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [maxMarks, setMaxMarks] = useState("100");
  const [submitting, setSubmitting] = useState(false);

  const { data: allClasses } = useApi<SchoolClass[]>(open && !isTeacher ? "/api/classes" : null);
  const { data: myAssignments } = useApi<TeacherAssignmentRow[]>(
    open && isTeacher ? "/api/me/assignments" : null,
  );
  const classOptions = isTeacher
    ? Array.from(new Map((myAssignments ?? []).map((a) => [a.classId, a.class])).values())
    : allClasses ?? [];

  const { data: subjects } = useApi<SubjectOption[]>(
    open && classId ? `/api/subjects?classId=${classId}` : null,
  );

  useEffect(() => {
    setSubjectId("");
  }, [classId]);

  function reset() {
    setTitle("");
    setDescription("");
    setClassId("");
    setSubjectId("");
    setDueDate("");
    setMaxMarks("100");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch("/api/assignments", {
        method: "POST",
        body: JSON.stringify({
          title,
          description: description || undefined,
          classId,
          subjectId,
          dueDate,
          maxMarks: Number(maxMarks),
        }),
      });
      toast.success("Assignment created");
      setOpen(false);
      reset();
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create assignment");
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
          <DialogTitle>New assignment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="a-title">Title</Label>
            <Input id="a-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="a-desc">Description</Label>
            <Textarea
              id="a-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Class</Label>
              <Select
                items={classOptions.map((c) => ({ value: c.id, label: c.name }))}
                value={classId}
                onValueChange={(v) => setClassId(v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Subject</Label>
              <Select
                items={subjectOptions}
                value={subjectId}
                onValueChange={(v) => setSubjectId(v ?? "")}
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
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="a-due">Due date</Label>
              <Input
                id="a-due"
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="a-max">Max marks</Label>
              <Input
                id="a-max"
                type="number"
                min={1}
                required
                value={maxMarks}
                onChange={(e) => setMaxMarks(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create assignment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
