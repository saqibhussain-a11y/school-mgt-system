"use client";

import { useState, type FormEvent, type ReactElement } from "react";
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
import { apiFetch, ApiError } from "@/lib/api-client";
import type { Room } from "./room-types";

const TYPE_OPTIONS = [
  { value: "GENERAL", label: "General classroom" },
  { value: "LAB", label: "Lab" },
];

export function RoomDialog({
  trigger,
  room,
  onSaved,
}: {
  trigger: ReactElement;
  room?: Room;
  onSaved: () => void;
}) {
  const isEdit = Boolean(room);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(room?.name ?? "");
  const [type, setType] = useState<string>(room?.type ?? "GENERAL");
  const [capacity, setCapacity] = useState(room?.capacity ? String(room.capacity) : "");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName("");
    setType("GENERAL");
    setCapacity("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body = { name, type, capacity: capacity ? Number(capacity) : undefined };
      if (isEdit) {
        await apiFetch(`/api/rooms/${room!.id}`, { method: "PATCH", body: JSON.stringify(body) });
        toast.success("Room updated");
      } else {
        await apiFetch("/api/rooms", { method: "POST", body: JSON.stringify(body) });
        toast.success("Room added");
        reset();
      }
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save room");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit room" : "Add room"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="room-name">Name</Label>
            <Input id="room-name" placeholder="Room 101" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Type</Label>
              <Select
                items={TYPE_OPTIONS}
                value={type}
                onValueChange={(v) => setType(v ?? "GENERAL")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="room-capacity">Capacity</Label>
              <Input
                id="room-capacity"
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Add room"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
