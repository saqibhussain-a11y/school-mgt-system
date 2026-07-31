"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { apiFetch, ApiError } from "@/lib/api-client";

export function SubmitAssignmentForm({
  assignmentId,
  hasExistingSubmission,
  onSubmitted,
}: {
  assignmentId: string;
  hasExistingSubmission: boolean;
  onSubmitted: () => void;
}) {
  const [textAnswer, setTextAnswer] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!textAnswer && !file) {
      toast.error("Add a text answer or attach a file before submitting");
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      if (textAnswer) formData.append("textAnswer", textAnswer);
      if (file) formData.append("file", file);
      await apiFetch(`/api/assignments/${assignmentId}/submissions/me`, {
        method: "POST",
        body: formData,
      });
      toast.success(hasExistingSubmission ? "Submission updated" : "Submitted");
      setTextAnswer("");
      setFile(null);
      onSubmitted();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="submission-text">Your answer</Label>
        <Textarea
          id="submission-text"
          rows={4}
          value={textAnswer}
          onChange={(e) => setTextAnswer(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="submission-file">Attach a file (optional)</Label>
        <Input
          id="submission-file"
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>
      <Button type="submit" disabled={submitting} className="w-fit">
        {submitting ? "Submitting…" : hasExistingSubmission ? "Resubmit" : "Submit"}
      </Button>
    </form>
  );
}
