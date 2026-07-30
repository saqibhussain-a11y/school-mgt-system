"use client";

import { useEffect, useState } from "react";
import { GraduationCap, Plus, X } from "lucide-react";
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="ghost" title="Manage classes" />}>
        <GraduationCap className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage classes</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
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

          <div className="flex items-end gap-2 border-t border-border pt-4">
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

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
