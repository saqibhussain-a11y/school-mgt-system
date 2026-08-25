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
import type { ExamTermSummary } from "./exam-term-types";

export function ManageExamTermsDialog({
  trigger,
  academicSessionId,
  onChanged,
}: {
  trigger: ReactElement;
  academicSessionId: string;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [order, setOrder] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: terms, refetch } = useApi<ExamTermSummary[]>(
    open && academicSessionId ? `/api/exam-terms?academicSessionId=${academicSessionId}` : null,
  );

  async function handleAdd() {
    if (!name || !order) return;
    setSubmitting(true);
    try {
      await apiFetch("/api/exam-terms", {
        method: "POST",
        body: JSON.stringify({ academicSessionId, name, order: Number(order) }),
      });
      toast.success("Term added");
      setName("");
      setOrder("");
      refetch();
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add term");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/api/exam-terms/${id}`, { method: "DELETE" });
      toast.success("Term removed");
      refetch();
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to remove term");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage terms</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="text-xs text-muted-foreground">
            Terms sequence exams within this academic session (e.g. Term 1 → Term 2 → Final) so a later exam can
            optionally show earlier terms side-by-side.
          </p>
          <div className="flex flex-col gap-2">
            {(terms ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No terms yet for this session.</p>
            ) : (
              (terms ?? []).map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span>
                    {t.order}. {t.name}
                  </span>
                  <ConfirmDialog
                    trigger={
                      <Button size="sm" variant="ghost" title="Remove">
                        <Trash2 className="size-3.5" />
                      </Button>
                    }
                    title="Remove this term?"
                    description="Only possible if no exam is linked to it."
                    confirmLabel="Remove"
                    destructive
                    onConfirm={() => handleDelete(t.id)}
                  />
                </div>
              ))
            )}
          </div>
          <div className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="term-name">Name</Label>
              <Input id="term-name" placeholder="e.g. Term 1" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex w-20 flex-col gap-2">
              <Label htmlFor="term-order">Order</Label>
              <Input
                id="term-order"
                type="number"
                min={1}
                value={order}
                onChange={(e) => setOrder(e.target.value)}
              />
            </div>
            <Button type="button" size="sm" disabled={submitting || !name || !order} onClick={handleAdd}>
              <Plus className="size-3.5" />
              Add
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
