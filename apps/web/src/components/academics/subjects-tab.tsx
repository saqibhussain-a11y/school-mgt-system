"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { SubjectDialog, type SubjectRow } from "./subject-dialog";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { SchoolClass } from "./classes-tab";

export function SubjectsTab({ canManage }: { canManage: boolean }) {
  const { data: classes } = useApi<SchoolClass[]>("/api/classes");
  const [classId, setClassId] = useState("");

  useEffect(() => {
    if (!classId && classes && classes.length > 0) {
      setClassId(classes[0].id);
    }
  }, [classes, classId]);

  const {
    data: subjects,
    loading,
    refetch,
  } = useApi<SubjectRow[]>(classId ? `/api/subjects?classId=${classId}` : null);

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/api/subjects/${id}`, { method: "DELETE" });
      toast.success("Subject deleted");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete subject");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-56">
          <Select
            items={(classes ?? []).map((c) => ({ value: c.id, label: c.name }))}
            value={classId}
            onValueChange={(value) => setClassId(value ?? "")}
          >
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
        </div>
        {canManage && (
          <SubjectDialog
            classId={classId}
            onSaved={refetch}
            trigger={
              <Button size="sm" disabled={!classId}>
                <Plus className="size-4" />
                New subject
              </Button>
            }
          />
        )}
      </div>

      {loading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : !subjects || subjects.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No subjects in this class yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Periods/week</TableHead>
                <TableHead>Room</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.periodsPerWeek}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.room ? (
                      <span className="inline-flex items-center gap-1.5">
                        {s.room.name}
                        {s.requiresLab && <Badge variant="secondary">Lab</Badge>}
                      </span>
                    ) : s.requiresLab ? (
                      <Badge variant="destructive">Lab required — no room set</Badge>
                    ) : (
                      "Class default"
                    )}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <SubjectDialog
                          classId={classId}
                          subject={s}
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
                          title="Delete this subject?"
                          description="Removes it from timetable generation for this class."
                          confirmLabel="Delete"
                          destructive
                          onConfirm={() => handleDelete(s.id)}
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
