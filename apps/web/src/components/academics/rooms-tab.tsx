"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RoomDialog } from "./room-dialog";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { Room } from "./room-types";

export function RoomsTab({ canManage }: { canManage: boolean }) {
  const { data: rooms, loading, refetch } = useApi<Room[]>("/api/rooms");

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/api/rooms/${id}`, { method: "DELETE" });
      toast.success("Room deleted");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete room");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <div className="flex justify-end">
          <RoomDialog
            onSaved={refetch}
            trigger={
              <Button size="sm">
                <Plus className="size-4" />
                Add room
              </Button>
            }
          />
        </div>
      )}
      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !rooms || rooms.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No rooms yet. Add rooms so classes and the timetable generator can use them.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Capacity</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>
                    <Badge variant={r.type === "LAB" ? "default" : "secondary"}>
                      {r.type === "LAB" ? "Lab" : "General"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.capacity ?? "—"}</TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <RoomDialog
                          room={r}
                          onSaved={refetch}
                          trigger={
                            <Button size="sm" variant="ghost" title="Edit">
                              <Pencil className="size-3.5" />
                            </Button>
                          }
                        />
                        <ConfirmDialog
                          trigger={
                            <Button size="sm" variant="ghost" title="Delete">
                              <Trash2 className="size-3.5" />
                            </Button>
                          }
                          title="Delete this room?"
                          description="Only possible if it isn't used by a class, subject, or timetable slot."
                          confirmLabel="Delete"
                          destructive
                          onConfirm={() => handleDelete(r.id)}
                        />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
