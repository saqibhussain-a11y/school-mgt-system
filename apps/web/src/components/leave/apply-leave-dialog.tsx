"use client";

import { useState, type FormEvent, type ReactElement } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { apiFetch, ApiError } from "@/lib/api-client";

const LEAVE_TYPES = [
  { value: "sick", label: "Sick" },
  { value: "casual", label: "Casual" },
  { value: "other", label: "Other" },
];

export function ApplyLeaveDialog({
  trigger,
  onSaved,
}: {
  trigger: ReactElement;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [leaveType, setLeaveType] = useState("sick");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setLeaveType("sick");
    setStartDate("");
    setEndDate("");
    setReason("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch("/api/leave-requests", {
        method: "POST",
        body: JSON.stringify({ leaveType, startDate, endDate, reason }),
      });
      toast.success("Leave request submitted");
      setOpen(false);
      reset();
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to submit leave request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Apply for leave</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Leave type</Label>
            <Select
              items={LEAVE_TYPES}
              value={leaveType}
              onValueChange={(v) => setLeaveType(v ?? "sick")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAVE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="lr-start">Start date</Label>
              <Input
                id="lr-start"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="lr-end">End date</Label>
              <Input
                id="lr-end"
                type="date"
                required
                min={startDate || undefined}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="lr-reason">Reason</Label>
            <Textarea
              id="lr-reason"
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
