"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch, ApiError } from "@/lib/api-client";

export function ClassSeatingTab({
  examId,
  examSessionId,
  onGenerated,
}: {
  examId: string;
  examSessionId: string | null;
  onGenerated: () => void;
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const result = await apiFetch<{ createdCount: number; unseatedStudentIds: string[] }>(
        `/api/exams/${examId}/seating/generate`,
        { method: "POST", body: JSON.stringify({}) },
      );
      toast.success(`Seated ${result.createdCount} student(s)`);
      if (result.unseatedStudentIds.length > 0) {
        toast.warning(`${result.unseatedStudentIds.length} student(s) couldn't be seated`);
      }
      onGenerated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to generate seating");
    } finally {
      setGenerating(false);
    }
  }

  if (!examSessionId) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3 py-8">
          <p className="text-sm text-muted-foreground">No seating has been generated for this class yet.</p>
          <Button size="sm" onClick={handleGenerate} disabled={generating}>
            <Sparkles className="size-4" />
            {generating ? "Generating…" : "Generate seating for this class"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-3 py-8">
        <p className="text-sm text-muted-foreground">
          This class's seating is part of a shared exam session — the seat chart includes other
          classes combined into that session, so it's shown on the session page.
        </p>
        <Button size="sm" variant="outline" onClick={() => router.push(`/dashboard/exam-sessions/${examSessionId}`)}>
          View full session seating
        </Button>
      </CardContent>
    </Card>
  );
}
