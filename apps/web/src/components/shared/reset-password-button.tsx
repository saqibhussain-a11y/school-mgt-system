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

export function ResetPasswordButton({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  async function handleReset() {
    setSubmitting(true);
    try {
      const res = await apiFetch<{ temporaryPassword: string }>(
        `/api/users/${userId}/reset-password`,
        { method: "POST" },
      );
      setTemporaryPassword(res.temporaryPassword);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to reset password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTemporaryPassword(null);
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="ghost" title="Reset password" />}>
        <KeyRound className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          {!temporaryPassword && (
            <DialogDescription>
              This immediately invalidates their current password and signs them out everywhere.
              Share the new temporary password with them yourself — it won&apos;t be shown again.
            </DialogDescription>
          )}
        </DialogHeader>

        {temporaryPassword ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted p-3 text-sm">
              <span className="text-muted-foreground">Temporary password</span>
              <span className="flex items-center gap-2 font-mono">
                {temporaryPassword}
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(temporaryPassword);
                    toast.success("Copied to clipboard");
                  }}
                  aria-label="Copy password"
                >
                  <Copy className="size-3.5" />
                </button>
              </span>
            </div>
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <DialogFooter>
            <Button variant="destructive" disabled={submitting} onClick={handleReset}>
              {submitting ? "Resetting…" : "Reset password"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
