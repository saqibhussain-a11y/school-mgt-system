"use client";

import { useEffect, useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { AcademicSession } from "@/components/academics/sessions-tab";

interface ClassOption {
  id: string;
  name: string;
}
interface SubjectOption {
  id: string;
  name: string;
}

export function CreateSyllabusDialog({
  trigger,
  onCreated,
}: {
  trigger: ReactElement;
  onCreated: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [academicSessionId, setAcademicSessionId] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: sessions } = useApi<AcademicSession[]>(open ? "/api/academic-sessions" : null);
  const { data: classes } = useApi<ClassOption[]>(
    open && academicSessionId ? `/api/classes?academicSessionId=${academicSessionId}` : null,
  );
  const { data: subjects } = useApi<SubjectOption[]>(
    open && classId ? `/api/subjects?classId=${classId}` : null,
  );

  useEffect(() => {
    if (!open) {
      setAcademicSessionId("");
      setClassId("");
      setSubjectId("");
    }
  }, [open]);

  useEffect(() => {
    setClassId("");
    setSubjectId("");
  }, [academicSessionId]);

  useEffect(() => {
    setSubjectId("");
  }, [classId]);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const syllabus = await apiFetch<{ id: string }>("/api/syllabuses", {
        method: "POST",
        body: JSON.stringify({ classId, subjectId, academicSessionId }),
      });
      toast.success("Syllabus created");
      setOpen(false);
      onCreated();
      router.push(`/dashboard/curriculum/${syllabus.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create syllabus");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New syllabus</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Academic session</Label>
            <Select
              items={(sessions ?? []).map((s) => ({ value: s.id, label: s.name }))}
              value={academicSessionId}
              onValueChange={(value) => setAcademicSessionId(value ?? "")}
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
              onValueChange={(value) => setClassId(value ?? "")}
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
          <div className="flex flex-col gap-2">
            <Label>Subject</Label>
            <Select
              items={(subjects ?? []).map((s) => ({ value: s.id, label: s.name }))}
              value={subjectId}
              onValueChange={(value) => setSubjectId(value ?? "")}
              disabled={!classId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                {(subjects ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            disabled={submitting || !academicSessionId || !classId || !subjectId}
            onClick={handleSubmit}
          >
            {submitting ? "Creating…" : "Create syllabus"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
