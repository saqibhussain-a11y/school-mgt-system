"use client";

import { useState } from "react";
import { Plus, Trash2, CalendarRange, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { BulkGenerateScheduleDialog } from "./bulk-generate-schedule-dialog";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { ChapterSummary } from "./types";

export function SchedulePanel({
  chapter,
  canManage,
  onChanged,
}: {
  chapter: ChapterSummary | null;
  canManage: boolean;
  onChanged: () => void;
}) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!chapter) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Select a chapter to plan its dates.</p>
        </CardContent>
      </Card>
    );
  }

  async function handleAdd() {
    if (!startDate || !endDate) return;
    setSubmitting(true);
    try {
      await apiFetch("/api/schedule-entries", {
        method: "POST",
        body: JSON.stringify({ chapterId: chapter!.id, startDate, endDate }),
      });
      toast.success("Schedule entry added");
      setStartDate("");
      setEndDate("");
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add schedule entry");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/api/schedule-entries/${id}`, { method: "DELETE" });
      toast.success("Schedule entry removed");
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to remove schedule entry");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule — {chapter.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {chapter.scheduleEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No dates planned for this chapter yet.</p>
        ) : (
          chapter.scheduleEntries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <span>
                {formatDate(entry.startDate)}
                {entry.startDate !== entry.endDate && ` – ${formatDate(entry.endDate)}`}
              </span>
              {canManage && (
                <ConfirmDialog
                  trigger={
                    <Button size="sm" variant="ghost" title="Remove">
                      <Trash2 className="size-3.5" />
                    </Button>
                  }
                  title="Remove this schedule entry?"
                  description="This date range will no longer be planned for this chapter."
                  confirmLabel="Remove"
                  destructive
                  onConfirm={() => handleDelete(entry.id)}
                />
              )}
            </div>
          ))
        )}

        {canManage && (
          <>
            <div className="flex items-end gap-2 pt-2">
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="entry-start">Start date</Label>
                <Input
                  id="entry-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="entry-end">End date</Label>
                <Input
                  id="entry-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <Button
                type="button"
                size="sm"
                disabled={submitting || !startDate || !endDate}
                onClick={handleAdd}
              >
                <Plus className="size-3.5" />
                Add
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <BulkGenerateScheduleDialog
                trigger={
                  <Button size="sm" variant="outline">
                    <CalendarRange className="size-3.5" />
                    Repeat across weeks
                  </Button>
                }
                chapterId={chapter.id}
                mode="REPEAT_WEEKLY"
                onGenerated={onChanged}
              />
              <BulkGenerateScheduleDialog
                trigger={
                  <Button size="sm" variant="outline">
                    <CalendarDays className="size-3.5" />
                    Split into days
                  </Button>
                }
                chapterId={chapter.id}
                mode="SPLIT_DAYS"
                onGenerated={onChanged}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
