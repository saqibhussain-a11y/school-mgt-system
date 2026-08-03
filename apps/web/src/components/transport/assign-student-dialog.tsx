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
import type { SchoolClass } from "@/components/academics/classes-tab";
import type { StudentSummary } from "@/components/students/types";

interface Section {
  id: string;
  name: string;
}

export function AssignStudentDialog({
  trigger,
  routeId,
  onAssigned,
}: {
  trigger: ReactElement;
  routeId: string;
  onAssigned: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [pickupStop, setPickupStop] = useState("");
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
    setPickupStop("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!studentId) return;
    setSubmitting(true);
    try {
      await apiFetch("/api/student-routes", {
        method: "POST",
        body: JSON.stringify({ studentId, routeId, pickupStop: pickupStop || undefined }),
      });
      toast.success("Student assigned to route");
      setOpen(false);
      reset();
      onAssigned();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to assign student");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign student to route</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          A student already on another route will be moved to this one instead.
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="as-stop">Pickup stop (optional)</Label>
            <Input id="as-stop" placeholder="e.g. Elm Street" value={pickupStop} onChange={(e) => setPickupStop(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!studentId || submitting}>
              {submitting ? "Assigning…" : "Assign to route"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
