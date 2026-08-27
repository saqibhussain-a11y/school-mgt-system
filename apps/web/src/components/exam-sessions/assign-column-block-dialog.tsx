"use client";

import { useEffect, useState, type ReactElement } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { Room } from "@/components/academics/room-types";

interface RoomColumn {
  id: string;
  columnNumber: number;
  seatCapacity: number;
}
interface Section {
  id: string;
  name: string;
}

const ALL_SECTIONS = "__all__";

export function AssignColumnBlockDialog({
  trigger,
  examSessionId,
  classes,
  onAssigned,
}: {
  trigger: ReactElement;
  examSessionId: string;
  classes: { id: string; name: string }[];
  onAssigned: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [columnId, setColumnId] = useState("");
  const [seatFrom, setSeatFrom] = useState("");
  const [seatTo, setSeatTo] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState(ALL_SECTIONS);
  const [submitting, setSubmitting] = useState(false);

  const { data: rooms } = useApi<Room[]>(open ? "/api/rooms" : null);
  const { data: columns } = useApi<RoomColumn[]>(
    open && roomId ? `/api/room-columns?roomId=${roomId}` : null,
  );
  const { data: sections } = useApi<Section[]>(
    open && classId ? `/api/sections?classId=${classId}` : null,
  );

  useEffect(() => {
    if (!open) {
      setRoomId("");
      setColumnId("");
      setSeatFrom("");
      setSeatTo("");
      setClassId("");
      setSectionId(ALL_SECTIONS);
    }
  }, [open]);

  useEffect(() => {
    setColumnId("");
  }, [roomId]);

  useEffect(() => {
    setSectionId(ALL_SECTIONS);
  }, [classId]);

  async function handleSubmit() {
    if (!roomId || !columnId || !seatFrom || !seatTo || !classId) return;
    setSubmitting(true);
    try {
      const created = await apiFetch<{ id: string }[]>(
        `/api/exam-sessions/${examSessionId}/seating/column-block`,
        {
          method: "POST",
          body: JSON.stringify({
            roomId,
            columnId,
            seatFrom: Number(seatFrom),
            seatTo: Number(seatTo),
            classId,
            sectionId: sectionId === ALL_SECTIONS ? undefined : sectionId,
          }),
        },
      );
      toast.success(`Seated ${created.length} student(s)`);
      setOpen(false);
      onAssigned();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to assign this block");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign a seat block</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Room</Label>
            <Select
              items={(rooms ?? []).map((r) => ({ value: r.id, label: r.name }))}
              value={roomId}
              onValueChange={(v) => setRoomId(v ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select room" />
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
          <div className="flex flex-col gap-2">
            <Label>Column</Label>
            <Select
              items={(columns ?? []).map((c) => ({
                value: c.id,
                label: `Column ${c.columnNumber} (${c.seatCapacity} seats)`,
              }))}
              value={columnId}
              onValueChange={(v) => setColumnId(v ?? "")}
              disabled={!roomId}
            >
              <SelectTrigger>
                <SelectValue placeholder={roomId && (columns ?? []).length === 0 ? "No columns configured" : "Select column"} />
              </SelectTrigger>
              <SelectContent>
                {(columns ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    Column {c.columnNumber} ({c.seatCapacity} seats)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="seat-from">From seat</Label>
              <Input id="seat-from" type="number" min={1} value={seatFrom} onChange={(e) => setSeatFrom(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="seat-to">To seat</Label>
              <Input id="seat-to" type="number" min={1} value={seatTo} onChange={(e) => setSeatTo(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Class</Label>
            <Select
              items={classes.map((c) => ({ value: c.id, label: c.name }))}
              value={classId}
              onValueChange={(v) => setClassId(v ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Section</Label>
            <Select
              items={[
                { value: ALL_SECTIONS, label: "All sections" },
                ...(sections ?? []).map((s) => ({ value: s.id, label: s.name })),
              ]}
              value={sectionId}
              onValueChange={(v) => setSectionId(v ?? ALL_SECTIONS)}
              disabled={!classId}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_SECTIONS}>All sections</SelectItem>
                {(sections ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Every active student in this class/section is packed into the range in admission-number
            order. Fewer students than seats is fine — the leftover seats stay open for another class
            to backfill later. More students than seats is an error.
          </p>
        </div>
        <DialogFooter>
          <Button
            type="button"
            disabled={submitting || !roomId || !columnId || !seatFrom || !seatTo || !classId}
            onClick={handleSubmit}
          >
            {submitting ? "Assigning…" : "Assign block"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
