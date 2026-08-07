"use client";

import { useState, type FormEvent, type ReactElement } from "react";
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
import type { Room } from "./room-types";

export interface SubjectRow {
  id: string;
  name: string;
  classId: string;
  periodsPerWeek: number;
  requiresLab: boolean;
  roomId: string | null;
  room: Room | null;
}

export function SubjectDialog({
  trigger,
  classId,
  subject,
  onSaved,
}: {
  trigger: ReactElement;
  classId: string;
  subject?: SubjectRow;
  onSaved: () => void;
}) {
  const isEdit = Boolean(subject);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(subject?.name ?? "");
  const [periodsPerWeek, setPeriodsPerWeek] = useState(String(subject?.periodsPerWeek ?? 1));
  const [requiresLab, setRequiresLab] = useState(subject?.requiresLab ?? false);
  const [roomId, setRoomId] = useState(subject?.roomId ?? "");
  const [submitting, setSubmitting] = useState(false);

  const { data: rooms } = useApi<Room[]>(open ? "/api/rooms" : null);
  const roomOptions = (rooms ?? []).filter((r) => !requiresLab || r.type === "LAB");

  function reset() {
    setName("");
    setPeriodsPerWeek("1");
    setRequiresLab(false);
    setRoomId("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body = {
        classId,
        name,
        periodsPerWeek: Number(periodsPerWeek),
        requiresLab,
        roomId: roomId || null,
      };
      if (isEdit) {
        await apiFetch(`/api/subjects/${subject!.id}`, { method: "PATCH", body: JSON.stringify(body) });
        toast.success("Subject updated");
      } else {
        await apiFetch("/api/subjects", { method: "POST", body: JSON.stringify(body) });
        toast.success("Subject created");
        reset();
      }
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save subject");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit subject" : "New subject"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="subj-name">Name</Label>
            <Input id="subj-name" placeholder="Mathematics" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="subj-periods">Periods per week</Label>
            <Input
              id="subj-periods"
              type="number"
              min={1}
              required
              value={periodsPerWeek}
              onChange={(e) => setPeriodsPerWeek(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={requiresLab}
              onCheckedChange={(v) => {
                setRequiresLab(v === true);
                setRoomId("");
              }}
            />
            Requires a lab room
          </label>
          <div className="flex flex-col gap-2">
            <Label>{requiresLab ? "Lab room" : "Preferred room"}</Label>
            <Select
              items={roomOptions.map((r) => ({ value: r.id, label: r.name }))}
              value={roomId}
              onValueChange={(v) => setRoomId(v ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder={requiresLab ? "Select a lab room" : "Use class default room"} />
              </SelectTrigger>
              <SelectContent>
                {roomOptions.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Create subject"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
