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
import type { Scholarship, ScholarshipDiscountType } from "./types";
import type { SchoolClass } from "@/components/academics/classes-tab";

interface StudentOption {
  id: string;
  admissionNo: string;
  user: { firstName: string; lastName: string };
}

const DISCOUNT_TYPES: { value: ScholarshipDiscountType; label: string }[] = [
  { value: "PERCENTAGE", label: "Percentage" },
  { value: "FLAT", label: "Flat amount" },
];

// Scholarships are scoped to the tuition fee category for now (confirmed
// scope) — the API field can hold any FeeCategory, so widening this to a
// picker later is additive, not a schema change.
const SCHOLARSHIP_CATEGORY = "tuition";

export function ScholarshipDialog({
  trigger,
  scholarship,
  onSaved,
}: {
  trigger: ReactElement;
  scholarship?: Scholarship;
  onSaved: () => void;
}) {
  const isEdit = Boolean(scholarship);
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [discountType, setDiscountType] = useState<ScholarshipDiscountType>(
    scholarship?.discountType ?? "PERCENTAGE",
  );
  const [discountValue, setDiscountValue] = useState(scholarship ? String(scholarship.discountValue) : "");
  const [submitting, setSubmitting] = useState(false);

  const { data: classes } = useApi<SchoolClass[]>(open && !isEdit ? "/api/classes" : null);
  const { data: students } = useApi<StudentOption[]>(open && !isEdit && classId ? `/api/students?classId=${classId}` : null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isEdit) {
        await apiFetch(`/api/scholarships/${scholarship!.id}`, {
          method: "PATCH",
          body: JSON.stringify({ discountType, discountValue: Number(discountValue) }),
        });
        toast.success("Scholarship updated");
      } else {
        await apiFetch("/api/scholarships", {
          method: "POST",
          body: JSON.stringify({
            studentId,
            category: SCHOLARSHIP_CATEGORY,
            discountType,
            discountValue: Number(discountValue),
          }),
        });
        toast.success("Scholarship created");
        setClassId("");
        setStudentId("");
        setDiscountValue("");
      }
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save scholarship");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit scholarship" : "New scholarship"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {isEdit ? (
            <div className="flex flex-col gap-1">
              <Label>Student</Label>
              <p className="text-sm text-muted-foreground">
                {scholarship!.student.user.firstName} {scholarship!.student.user.lastName} (
                {scholarship!.student.admissionNo}) — Tuition
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <Label>Class</Label>
                <Select
                  items={(classes ?? []).map((c) => ({ value: c.id, label: c.name }))}
                  value={classId}
                  onValueChange={(v) => {
                    setClassId(v ?? "");
                    setStudentId("");
                  }}
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
                <Label>Student</Label>
                <Select
                  items={(students ?? []).map((s) => ({
                    value: s.id,
                    label: `${s.user.firstName} ${s.user.lastName} (${s.admissionNo})`,
                  }))}
                  value={studentId}
                  onValueChange={(v) => setStudentId(v ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={classId ? "Select student" : "Select a class first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(students ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.user.firstName} {s.user.lastName} ({s.admissionNo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Fee category</Label>
                <p className="text-sm text-muted-foreground capitalize">{SCHOLARSHIP_CATEGORY}</p>
              </div>
            </>
          )}
          <div className="flex flex-col gap-2">
            <Label>Discount type</Label>
            <Select
              items={DISCOUNT_TYPES}
              value={discountType}
              onValueChange={(v) => setDiscountType((v as ScholarshipDiscountType) ?? "PERCENTAGE")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DISCOUNT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sch-value">{discountType === "PERCENTAGE" ? "Discount %" : "Discount amount"}</Label>
            <Input
              id="sch-value"
              type="number"
              min={0.01}
              max={discountType === "PERCENTAGE" ? 100 : undefined}
              step="0.01"
              required
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting || (!isEdit && !studentId)}>
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Create scholarship"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
