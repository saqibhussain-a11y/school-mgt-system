"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ClassDialog } from "./class-dialog";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { AcademicSession } from "./sessions-tab";
import type { Room } from "./room-types";

export interface SchoolClass {
  id: string;
  name: string;
  academicSessionId: string;
  defaultRoomId: string | null;
  defaultRoom: Room | null;
}

export function ClassesTab({ canManage }: { canManage: boolean }) {
  const { data: sessions } = useApi<AcademicSession[]>("/api/academic-sessions");
  const [sessionId, setSessionId] = useState<string>("");

  useEffect(() => {
    if (!sessionId && sessions && sessions.length > 0) {
      setSessionId(sessions[0].id);
    }
  }, [sessions, sessionId]);

  const {
    data: classes,
    loading,
    refetch,
  } = useApi<SchoolClass[]>(sessionId ? `/api/classes?academicSessionId=${sessionId}` : null);

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/api/classes/${id}`, { method: "DELETE" });
      toast.success("Class deleted");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete class");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-56">
          <Select
            items={(sessions ?? []).map((s) => ({ value: s.id, label: s.name }))}
            value={sessionId}
            onValueChange={(value) => setSessionId(value ?? "")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select session" />
            </SelectTrigger>
            <SelectContent>
              {(sessions ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canManage && (
          <ClassDialog
            academicSessionId={sessionId}
            onSaved={refetch}
            trigger={
              <Button size="sm" disabled={!sessionId}>
                <Plus className="size-4" />
                New class
              </Button>
            }
          />
        )}
      </div>

      {loading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : !classes || classes.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No classes in this session yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Default room</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.map((cls) => (
                <TableRow key={cls.id}>
                  <TableCell className="font-medium">{cls.name}</TableCell>
                  <TableCell className="text-muted-foreground">{cls.defaultRoom?.name ?? "—"}</TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <ClassDialog
                          academicSessionId={sessionId}
                          cls={cls}
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
                          title="Delete this class?"
                          description="Only possible if it has no sections, students, or subjects."
                          confirmLabel="Delete"
                          destructive
                          onConfirm={() => handleDelete(cls.id)}
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
