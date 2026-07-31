"use client";

import { useState, type FormEvent, type ReactElement } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import { FEE_CATEGORIES, type FeeStructure } from "./types";
import type { SchoolClass } from "@/components/academics/classes-tab";

export function FeeStructureDialog({
  trigger,
  structure,
  onSaved,
}: {
  trigger: ReactElement;
  structure?: FeeStructure;
  onSaved: () => void;
}) {
  const isEdit = Boolean(structure);
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState(structure?.classId ?? "");
  const [category, setCategory] = useState(structure?.category ?? "");
  const [amount, setAmount] = useState(structure ? String(structure.amount) : "");
  const [submitting, setSubmitting] = useState(false);

  const { data: classes } = useApi<SchoolClass[]>(open && !isEdit ? "/api/classes" : null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isEdit) {
        await apiFetch(`/api/fee-structures/${structure!.id}`, {
          method: "PATCH",
          body: JSON.stringify({ amount: Number(amount) }),
        });
        toast.success("Fee structure updated");
      } else {
        await apiFetch("/api/fee-structures", {
          method: "POST",
          body: JSON.stringify({ classId, category, amount: Number(amount) }),
        });
        toast.success("Fee structure created");
        setClassId("");
        setCategory("");
        setAmount("");
      }
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save fee structure");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit fee structure" : "New fee structure"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!isEdit && (
            <>
              <div className="flex flex-col gap-2">
                <Label>Class</Label>
                <Select
                  items={(classes ?? []).map((c) => ({ value: c.id, label: c.name }))}
                  value={classId}
                  onValueChange={(v) => setClassId(v ?? "")}
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
              <div className="flex flex-col gap-2">
                <Label>Category</Label>
                <Select
                  items={FEE_CATEGORIES.map((c) => ({ value: c, label: c }))}
                  value={category}
                  onValueChange={(v) => setCategory(v ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {FEE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c} className="capitalize">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="fs-amount">Amount</Label>
            <Input
              id="fs-amount"
              type="number"
              min={0.01}
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Create fee structure"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
