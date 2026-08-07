"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PeriodDialog } from "./period-dialog";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { Period } from "./room-types";

export function PeriodsTab({ canManage }: { canManage: boolean }) {
  const { data: periods, loading, refetch } = useApi<Period[]>("/api/periods");

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/api/periods/${id}`, { method: "DELETE" });
      toast.success("Period deleted");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete period");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <div className="flex justify-end">
          <PeriodDialog
            onSaved={refetch}
            trigger={
              <Button size="sm">
                <Plus className="size-4" />
                Add period
              </Button>
            }
          />
        </div>
      )}
      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !periods || periods.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No periods yet. Set up the school's daily period grid before generating a timetable.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Type</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">Period {p.periodNumber}</TableCell>
                  <TableCell>{p.startTime}</TableCell>
                  <TableCell>{p.endTime}</TableCell>
                  <TableCell>
                    {p.isBreak ? <Badge variant="secondary">Break</Badge> : <Badge>Teaching</Badge>}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <PeriodDialog
                          period={p}
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
                          title="Delete this period?"
                          description="Only possible if it isn't used by the timetable."
                          confirmLabel="Delete"
                          destructive
                          onConfirm={() => handleDelete(p.id)}
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
