"use client";

import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import type { SubmissionDetail } from "@/components/assignments/types";

export function SubmissionStatusDisplay({
  submission,
  assignmentId,
  studentId,
  maxMarks,
}: {
  submission: SubmissionDetail | null;
  assignmentId: string;
  studentId: string;
  maxMarks: number;
}) {
  async function handleDownload() {
    try {
      const { url } = await apiFetch<{ url: string }>(
        `/api/assignments/${assignmentId}/submissions/${studentId}/file-url`,
      );
      window.open(url, "_blank");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to get download link");
    }
  }

  if (!submission) {
    return <p className="text-sm text-muted-foreground">No submission yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
        <span>Submitted {formatDate(submission.submittedAt)}</span>
        {submission.grade && (
          <Badge>
            {submission.percentage}% ({submission.grade})
          </Badge>
        )}
        {!submission.grade && <Badge variant="secondary">Not graded yet</Badge>}
      </div>
      {submission.textAnswer && (
        <div className="rounded-lg border border-border p-3 whitespace-pre-wrap">
          {submission.textAnswer}
        </div>
      )}
      {submission.fileFilename && (
        <Button size="sm" variant="outline" className="w-fit" onClick={handleDownload}>
          <Download className="size-3.5" />
          {submission.fileFilename}
        </Button>
      )}
      {submission.feedback && (
        <div>
          <p className="text-xs text-muted-foreground">Feedback</p>
          <p>{submission.feedback}</p>
        </div>
      )}
      {submission.marksObtained !== null && (
        <p className="text-xs text-muted-foreground">
          {submission.marksObtained} / {maxMarks} marks
        </p>
      )}
    </div>
  );
}

export function SubmissionStatusView({
  assignmentId,
  studentId,
  maxMarks,
}: {
  assignmentId: string;
  studentId: string;
  maxMarks: number;
}) {
  const { data: submission, loading } = useApi<SubmissionDetail | null>(
    `/api/assignments/${assignmentId}/submissions/${studentId}`,
  );

  if (loading) return <Skeleton className="h-32 rounded-xl" />;
  return (
    <SubmissionStatusDisplay
      submission={submission ?? null}
      assignmentId={assignmentId}
      studentId={studentId}
      maxMarks={maxMarks}
    />
  );
}
