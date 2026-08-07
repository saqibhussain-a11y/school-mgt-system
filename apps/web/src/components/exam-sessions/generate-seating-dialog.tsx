"use client";

import { useState, type ReactElement } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { Room } from "@/components/academics/room-types";

export function GenerateSeatingDialog({
  trigger,
  examSessionId,
  onGenerated,
}: {
  trigger: ReactElement;
  examSessionId: string;
  onGenerated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [roomIds, setRoomIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const { data: rooms } = useApi<Room[]>(open ? "/api/rooms" : null);

  function toggleRoom(roomId: string) {
    setRoomIds((prev) => (prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [...prev, roomId]));
  }

  async function handleGenerate() {
    setSubmitting(true);
    try {
      const result = await apiFetch<{
        createdCount: number;
        unseatedStudentIds: string[];
        staleInvigilationWarnings: string[];
      }>(`/api/exam-sessions/${examSessionId}/seating/generate`, {
        method: "POST",
        body: JSON.stringify({ roomIds: roomIds.length > 0 ? roomIds : undefined }),
      });
      toast.success(`Seated ${result.createdCount} student(s)`);
      if (result.unseatedStudentIds.length > 0) {
        toast.warning(`${result.unseatedStudentIds.length} student(s) couldn't be seated — add more room capacity`);
      }
      for (const w of result.staleInvigilationWarnings) toast.warning(w);
      setOpen(false);
      onGenerated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to generate seating");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate seating</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Label>Rooms to seat this session in</Label>
          <div className="flex flex-col gap-2 rounded-md border p-3">
            {(rooms ?? []).map((room) => (
              <label key={room.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={roomIds.includes(room.id)} onCheckedChange={() => toggleRoom(room.id)} />
                {room.name} {room.capacity != null ? `(capacity ${room.capacity})` : "(no capacity set)"}
              </label>
            ))}
            {(rooms ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground">No rooms configured yet.</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Leave everything unchecked to reuse whichever rooms are already in this session's seating.
            Rooms need a capacity set before they can be used here.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={handleGenerate} disabled={submitting}>
            {submitting ? "Generating…" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
