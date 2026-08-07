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
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { Room } from "./room-types";
import type { SchoolClass } from "./classes-tab";

export function ClassDialog({
  trigger,
  academicSessionId,
  cls,
  onSaved,
}: {
  trigger: ReactElement;
  academicSessionId: string;
  cls?: SchoolClass;
  onSaved: () => void;
}) {
  const isEdit = Boolean(cls);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(cls?.name ?? "");
  const [defaultRoomId, setDefaultRoomId] = useState(cls?.defaultRoomId ?? "");
  const [submitting, setSubmitting] = useState(false);

  const { data: rooms } = useApi<Room[]>(open ? "/api/rooms" : null);

  function reset() {
    setName("");
    setDefaultRoomId("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body = { name, academicSessionId, defaultRoomId: defaultRoomId || null };
      if (isEdit) {
        await apiFetch(`/api/classes/${cls!.id}`, { method: "PATCH", body: JSON.stringify(body) });
        toast.success("Class updated");
      } else {
        await apiFetch("/api/classes", { method: "POST", body: JSON.stringify(body) });
        toast.success("Class created");
        reset();
      }
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save class");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit class" : "New class"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="class-name">Name</Label>
            <Input id="class-name" placeholder="Grade 5" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Default room</Label>
            <Select
              items={(rooms ?? []).map((r) => ({ value: r.id, label: r.name }))}
              value={defaultRoomId}
              onValueChange={(v) => setDefaultRoomId(v ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="No default room" />
              </SelectTrigger>
              <SelectContent>
                {(rooms ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Create class"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
