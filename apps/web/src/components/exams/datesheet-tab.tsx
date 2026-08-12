"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { ExamSummary } from "@/components/exams/types";

// @dnd-kit is only needed once an exam actually has a datesheet to drag —
// deferred out of the initial bundle for every visitor to this page,
// including ones who never open this tab.
const DatesheetGrid = dynamic(
  () => import("@/components/exams/datesheet-grid").then((m) => m.DatesheetGrid),
  { ssr: false, loading: () => <Skeleton className="h-96 rounded-xl" /> },
);

function GenerateDatesheetDialog({
  examId,
  isSessionLinked,
  onGenerated,
}: {
  examId: string;
  isSessionLinked: boolean;
  onGenerated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");
  const [submitting, setSubmitting] = useState(false);

  async function handleGenerate() {
    setSubmitting(true);
    try {
      const result = await apiFetch<{ updatedCount: number; warnings: string[] }>(
        `/api/exams/${examId}/datesheet/generate`,
        { method: "POST", body: JSON.stringify({ startTime, endTime }) },
      );
      toast.success(`Scheduled ${result.updatedCount} paper(s)`);
      for (const w of result.warnings) toast.warning(w);
      setOpen(false);
      onGenerated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to generate datesheet");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Sparkles className="size-4" />
            Auto-generate
          </Button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Generate datesheet</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ds-start">Start time</Label>
            <Input id="ds-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ds-end">End time</Label>
            <Input id="ds-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Fills in subjects that don&apos;t have a date yet, walking forward one per working day. Subjects
          that already have a date are left alone.
          {isSessionLinked && " This exam is part of a combined session — generating also fills in every other linked class's datesheet, so they stay on the same day."}
        </p>
        <DialogFooter>
          <Button onClick={handleGenerate} disabled={submitting}>
            {submitting ? "Generating…" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DatesheetTab({ exam, onChanged }: { exam: ExamSummary; onChanged: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <GenerateDatesheetDialog
          examId={exam.id}
          isSessionLinked={!!exam.examSession}
          onGenerated={onChanged}
        />
      </div>
      {exam.examSubjects.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            This exam has no subjects yet.
          </CardContent>
        </Card>
      ) : (
        <DatesheetGrid exam={exam} />
      )}
    </div>
  );
}
