"use client";

import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

interface Holiday {
  id: string;
  date: string;
  name: string;
}

export function HolidaysTab({ canManage }: { canManage: boolean }) {
  const { data: holidays, loading, refetch } = useApi<Holiday[]>("/api/holidays");
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch("/api/holidays", { method: "POST", body: JSON.stringify({ date, name }) });
      toast.success("Holiday added");
      setOpen(false);
      setDate("");
      setName("");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add holiday");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/api/holidays/${id}`, { method: "DELETE" });
      toast.success("Holiday removed");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to remove holiday");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <div className="flex justify-end">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button size="sm" />}>
              <Plus className="size-4" />
              New holiday
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New holiday</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="holiday-date">Date</Label>
                  <Input
                    id="holiday-date"
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="holiday-name">Name</Label>
                  <Input
                    id="holiday-name"
                    placeholder="Independence Day"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Adding…" : "Add holiday"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {loading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : !holidays || holidays.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No holidays configured yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Name</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {holidays.map((holiday) => (
                <TableRow key={holiday.id}>
                  <TableCell>{formatDate(holiday.date)}</TableCell>
                  <TableCell className="font-medium">{holiday.name}</TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <ConfirmDialog
                        trigger={
                          <Button size="sm" variant="ghost">
                            <Trash2 className="size-4" />
                          </Button>
                        }
                        title="Remove this holiday?"
                        description="Attendance can then be marked on this date again."
                        confirmLabel="Remove"
                        destructive
                        onConfirm={() => handleDelete(holiday.id)}
                      />
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
