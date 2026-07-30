"use client";

import { useState, type FormEvent } from "react";
import { Pencil } from "lucide-react";
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
import { apiFetch, ApiError } from "@/lib/api-client";
import type { StudentSummary } from "./types";

interface Section {
  id: string;
  name: string;
}

export function EditStudentDialog({
  student,
  onSaved,
}: {
  student: StudentSummary;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [sectionId, setSectionId] = useState(student.sectionId);
  const [previousSchool, setPreviousSchool] = useState(student.previousSchool ?? "");
  const [medicalInfo, setMedicalInfo] = useState(student.medicalInfo ?? "");
  const [submitting, setSubmitting] = useState(false);

  const { data: sections } = useApi<Section[]>(
    open ? `/api/sections?classId=${student.classId}` : null,
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch(`/api/students/${student.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          sectionId,
          previousSchool: previousSchool || null,
          medicalInfo: medicalInfo || null,
        }),
      });
      toast.success("Student updated");
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update student");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Pencil className="size-4" />
        Edit
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit student</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Section (within {student.class.name})</Label>
            <Select
              items={(sections ?? []).map((s) => ({ value: s.id, label: s.name }))}
              value={sectionId}
              onValueChange={(v) => setSectionId(v ?? sectionId)}
            >
              <SelectTrigger>
                <SelectValue />
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-previousSchool">Previous school</Label>
            <Input
              id="edit-previousSchool"
              value={previousSchool}
              onChange={(e) => setPreviousSchool(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-medicalInfo">Medical info</Label>
            <Textarea
              id="edit-medicalInfo"
              value={medicalInfo}
              onChange={(e) => setMedicalInfo(e.target.value)}
            />
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
