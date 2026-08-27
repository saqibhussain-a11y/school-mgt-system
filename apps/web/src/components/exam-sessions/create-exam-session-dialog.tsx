"use client";

import { useEffect, useState, type FormEvent, type ReactElement } from "react";
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
import type { AcademicSession } from "@/components/academics/sessions-tab";
import type { SeatingStrategy } from "./exam-session-types";

export function CreateExamSessionDialog({
  trigger,
  onSaved,
}: {
  trigger: ReactElement;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [academicSessionId, setAcademicSessionId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [seatingStrategy, setSeatingStrategy] = useState<SeatingStrategy>("INTERLEAVED");
  const [submitting, setSubmitting] = useState(false);

  const { data: sessions } = useApi<AcademicSession[]>(open ? "/api/academic-sessions" : null);

  useEffect(() => {
    if (open && !academicSessionId && sessions && sessions.length > 0) {
      setAcademicSessionId(sessions[0].id);
    }
  }, [open, sessions, academicSessionId]);

  function reset() {
    setName("");
    setStartDate("");
    setEndDate("");
    setSeatingStrategy("INTERLEAVED");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch("/api/exam-sessions", {
        method: "POST",
        body: JSON.stringify({ name, academicSessionId, startDate, endDate, seatingStrategy }),
      });
      toast.success("Exam session created");
      setOpen(false);
      reset();
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create exam session");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New exam session</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="session-name">Name</Label>
            <Input
              id="session-name"
              required
              placeholder="e.g. Mid-Term Exam 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Academic session</Label>
            <Select
              items={(sessions ?? []).map((s) => ({ value: s.id, label: s.name }))}
              value={academicSessionId}
              onValueChange={(v) => setAcademicSessionId(v ?? "")}
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
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="session-start">Start date</Label>
              <Input
                id="session-start"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="session-end">End date</Label>
              <Input
                id="session-end"
                type="date"
                required
                min={startDate || undefined}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Seating strategy</Label>
            <Select
              items={[
                { value: "INTERLEAVED", label: "Interleaved (auto-generated, mixed by seat)" },
                { value: "COLUMN_BLOCKED", label: "Column-blocked (manual, one class per column)" },
              ]}
              value={seatingStrategy}
              onValueChange={(v) => setSeatingStrategy((v as SeatingStrategy) ?? "INTERLEAVED")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INTERLEAVED">Interleaved (auto-generated, mixed by seat)</SelectItem>
                <SelectItem value="COLUMN_BLOCKED">Column-blocked (manual, one class per column)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Can&apos;t be changed once seats have been assigned.
            </p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create session"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
