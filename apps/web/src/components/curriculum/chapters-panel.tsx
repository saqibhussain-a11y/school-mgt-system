"use client";

import { useState } from "react";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { apiFetch, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { ChapterSummary } from "./types";

export function ChaptersPanel({
  syllabusId,
  chapters,
  canManage,
  selectedChapterId,
  onSelect,
  onChanged,
}: {
  syllabusId: string;
  chapters: ChapterSummary[];
  canManage: boolean;
  selectedChapterId: string | null;
  onSelect: (chapterId: string) => void;
  onChanged: () => void;
}) {
  const [title, setTitle] = useState("");
  const [order, setOrder] = useState(String(chapters.length + 1));
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editOrder, setEditOrder] = useState("");

  async function handleAdd() {
    if (!title || !order) return;
    setSubmitting(true);
    try {
      await apiFetch("/api/chapters", {
        method: "POST",
        body: JSON.stringify({ syllabusId, title, order: Number(order) }),
      });
      toast.success("Chapter added");
      setTitle("");
      setOrder(String(chapters.length + 2));
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add chapter");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(chapter: ChapterSummary) {
    setEditingId(chapter.id);
    setEditTitle(chapter.title);
    setEditOrder(String(chapter.order));
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    try {
      await apiFetch(`/api/chapters/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({ title: editTitle, order: Number(editOrder) }),
      });
      toast.success("Chapter updated");
      setEditingId(null);
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update chapter");
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/api/chapters/${id}`, { method: "DELETE" });
      toast.success("Chapter removed");
      if (selectedChapterId === id) onSelect("");
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to remove chapter");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chapters</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {chapters.length === 0 ? (
          <p className="text-sm text-muted-foreground">No chapters yet.</p>
        ) : (
          chapters.map((chapter) => (
            <div
              key={chapter.id}
              className={cn(
                "flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm",
                selectedChapterId === chapter.id && "border-primary bg-primary/5",
              )}
            >
              {editingId === chapter.id ? (
                <div className="flex flex-1 items-center gap-2">
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="h-8"
                  />
                  <Input
                    type="number"
                    min={1}
                    value={editOrder}
                    onChange={(e) => setEditOrder(e.target.value)}
                    className="h-8 w-16"
                  />
                  <Button size="sm" variant="ghost" onClick={handleSaveEdit} title="Save">
                    <Check className="size-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} title="Cancel">
                    <X className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className="flex-1 text-left"
                    onClick={() => onSelect(chapter.id)}
                  >
                    {chapter.order}. {chapter.title}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {chapter.scheduleEntries.length} schedule{" "}
                      {chapter.scheduleEntries.length === 1 ? "entry" : "entries"}
                    </span>
                  </button>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(chapter)} title="Edit">
                        <Pencil className="size-3.5" />
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button size="sm" variant="ghost" title="Remove">
                            <Trash2 className="size-3.5" />
                          </Button>
                        }
                        title="Remove this chapter?"
                        description="Its scheduled dates will be removed too."
                        confirmLabel="Remove"
                        destructive
                        onConfirm={() => handleDelete(chapter.id)}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          ))
        )}

        {canManage && (
          <div className="flex items-end gap-2 pt-2">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="chapter-title">Title</Label>
              <Input
                id="chapter-title"
                placeholder="e.g. Fractions"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="flex w-20 flex-col gap-2">
              <Label htmlFor="chapter-order">Order</Label>
              <Input
                id="chapter-order"
                type="number"
                min={1}
                value={order}
                onChange={(e) => setOrder(e.target.value)}
              />
            </div>
            <Button type="button" size="sm" disabled={submitting || !title || !order} onClick={handleAdd}>
              <Plus className="size-3.5" />
              Add
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
