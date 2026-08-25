"use client";

import { useState } from "react";
import { Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiFetch, ApiError } from "@/lib/api-client";

type Result = { mode: "ADMIN_SET"; email: string; temporaryPassword: string } | { mode: "SELF_SERVICE"; email: string };

export function GenerateCredentialsDialog({ studentId, onIssued }: { studentId: string; onIssued: () => void }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState<"ADMIN_SET" | "SELF_SERVICE" | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function handleGenerate(mode: "ADMIN_SET" | "SELF_SERVICE") {
    setSubmitting(mode);
    try {
      const res = await apiFetch<Result>(`/api/students/${studentId}/generate-credentials`, {
        method: "POST",
        body: JSON.stringify({ mode }),
      });
      setResult(res);
      onIssued();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to issue credentials");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setResult(null);
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <KeyRound className="size-4" />
        Generate credentials
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Generate login credentials</DialogTitle>
          {!result && (
            <DialogDescription>
              This student has no login access yet. Choose how to issue it.
            </DialogDescription>
          )}
        </DialogHeader>

        {result ? (
          result.mode === "ADMIN_SET" ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Share these credentials with the student — this password won&apos;t be shown again.
              </p>
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-mono">{result.email}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Temporary password</span>
                  <span className="flex items-center gap-2 font-mono">
                    {result.temporaryPassword}
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(result.temporaryPassword);
                        toast.success("Copied to clipboard");
                      }}
                      aria-label="Copy password"
                    >
                      <Copy className="size-3.5" />
                    </button>
                  </span>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => setOpen(false)}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                An email with a one-time code has been sent to <span className="font-mono">{result.email}</span> —
                they can use it to set their own password.
              </p>
              <DialogFooter>
                <Button onClick={() => setOpen(false)}>Done</Button>
              </DialogFooter>
            </div>
          )
        ) : (
          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              className="justify-start"
              disabled={submitting !== null}
              onClick={() => handleGenerate("ADMIN_SET")}
            >
              {submitting === "ADMIN_SET" ? "Generating…" : "I'll set a password myself"}
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              disabled={submitting !== null}
              onClick={() => handleGenerate("SELF_SERVICE")}
            >
              {submitting === "SELF_SERVICE" ? "Sending…" : "Let them set their own password"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
