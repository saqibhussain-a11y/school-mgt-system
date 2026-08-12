"use client";

import { useEffect, useState, type FormEvent, type ReactElement } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import type { StudentSummary } from "@/components/students/types";
import { LOAN_PERIOD_DAYS } from "./types";

interface Section {
  id: string;
  name: string;
}

export function IssueBookDialog({
  trigger,
  book,
  onIssued,
}: {
  trigger: ReactElement;
  book: { id: string; title: string; availableCopies: number };
  onIssued: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: classes } = useApi<SchoolClass[]>(open ? "/api/classes" : null);
  const { data: sections } = useApi<Section[]>(open && classId ? `/api/sections?classId=${classId}` : null);
  const { data: students } = useApi<StudentSummary[]>(
    open && sectionId ? `/api/students?classId=${classId}&sectionId=${sectionId}` : null,
  );

  useEffect(() => {
    setSectionId("");
    setStudentId("");
  }, [classId]);
  useEffect(() => {
    setStudentId("");
  }, [sectionId]);

  function reset() {
    setClassId("");
    setSectionId("");
    setStudentId("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!studentId) return;
    setSubmitting(true);
    try {
      await apiFetch("/api/book-loans", { method: "POST", body: JSON.stringify({ bookId: book.id, studentId }) });
      toast.success("Book issued");
      setOpen(false);
      reset();
      onIssued();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to issue book");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Issue &quot;{book.title}&quot;</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {book.availableCopies} cop{book.availableCopies === 1 ? "y" : "ies"} available. Due back in{" "}
          {LOAN_PERIOD_DAYS} days.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Select items={(classes ?? []).map((c) => ({ value: c.id, label: c.name }))} value={classId} onValueChange={(v) => setClassId(v ?? "")}>
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
          <Select
            items={(sections ?? []).map((s) => ({ value: s.id, label: s.name }))}
            value={sectionId}
            onValueChange={(v) => setSectionId(v ?? "")}
          >
            <SelectTrigger disabled={!classId}>
              <SelectValue placeholder="Select section" />
            </SelectTrigger>
            <SelectContent>
              {(sections ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            items={(students ?? []).map((s) => ({ value: s.id, label: `${s.user.firstName} ${s.user.lastName} (${s.admissionNo})` }))}
            value={studentId}
            onValueChange={(v) => setStudentId(v ?? "")}
          >
            <SelectTrigger disabled={!sectionId}>
              <SelectValue placeholder="Select student" />
            </SelectTrigger>
            <SelectContent>
              {(students ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.user.firstName} {s.user.lastName} ({s.admissionNo})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button type="submit" disabled={!studentId || submitting}>
              {submitting ? "Issuing…" : "Issue book"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
