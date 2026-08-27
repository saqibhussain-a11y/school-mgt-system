"use client";

import { useState, type ReactElement } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";

interface RoomColumn {
  id: string;
  columnNumber: number;
  seatCapacity: number;
}

export function ManageRoomColumnsDialog({
  trigger,
  roomId,
  roomName,
}: {
  trigger: ReactElement;
  roomId: string;
  roomName: string;
}) {
  const [open, setOpen] = useState(false);
  const [columnNumber, setColumnNumber] = useState("");
  const [seatCapacity, setSeatCapacity] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: columns, refetch } = useApi<RoomColumn[]>(
    open ? `/api/room-columns?roomId=${roomId}` : null,
  );

  async function handleAdd() {
    if (!columnNumber || !seatCapacity) return;
    setSubmitting(true);
    try {
      await apiFetch("/api/room-columns", {
        method: "POST",
        body: JSON.stringify({
          roomId,
          columnNumber: Number(columnNumber),
          seatCapacity: Number(seatCapacity),
        }),
      });
      toast.success("Column added");
      setColumnNumber("");
      setSeatCapacity("");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add column");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/api/room-columns/${id}`, { method: "DELETE" });
      toast.success("Column removed");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to remove column");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Columns in {roomName}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="text-xs text-muted-foreground">
            Configure this room&apos;s physical columns and their seat capacity — needed only for the
            column-blocked exam seating strategy. A room with no columns can still be used for the
            regular interleaved seating.
          </p>
          <div className="flex flex-col gap-2">
            {(columns ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No columns configured for this room yet.</p>
            ) : (
              (columns ?? []).map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span>
                    Column {c.columnNumber} — {c.seatCapacity} seats
                  </span>
                  <ConfirmDialog
                    trigger={
                      <Button size="sm" variant="ghost" title="Remove">
                        <Trash2 className="size-3.5" />
                      </Button>
                    }
                    title="Remove this column?"
                    description="Only possible if no student is already seated in it."
                    confirmLabel="Remove"
                    destructive
                    onConfirm={() => handleDelete(c.id)}
                  />
                </div>
              ))
            )}
          </div>
          <div className="flex items-end gap-2">
            <div className="flex w-28 flex-col gap-2">
              <Label htmlFor="column-number">Column #</Label>
              <Input
                id="column-number"
                type="number"
                min={1}
                value={columnNumber}
                onChange={(e) => setColumnNumber(e.target.value)}
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="column-capacity">Seats</Label>
              <Input
                id="column-capacity"
                type="number"
                min={1}
                value={seatCapacity}
                onChange={(e) => setSeatCapacity(e.target.value)}
              />
            </div>
            <Button
              type="button"
              size="sm"
              disabled={submitting || !columnNumber || !seatCapacity}
              onClick={handleAdd}
            >
              <Plus className="size-3.5" />
              Add
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
