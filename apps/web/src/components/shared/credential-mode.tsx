"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";

export type CredentialMode = "ADMIN_SET" | "SELF_SERVICE";

export type CredentialResult =
  | { mode: "ADMIN_SET"; email: string; temporaryPassword: string }
  | { mode: "SELF_SERVICE"; email: string };

export function CredentialModeField({
  mode,
  onChange,
}: {
  mode: CredentialMode;
  onChange: (mode: CredentialMode) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>Login credentials</Label>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "ADMIN_SET" ? "default" : "outline"}
          className="flex-1"
          onClick={() => onChange("ADMIN_SET")}
        >
          I&apos;ll set a password
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "SELF_SERVICE" ? "default" : "outline"}
          className="flex-1"
          onClick={() => onChange("SELF_SERVICE")}
        >
          Email them an invite
        </Button>
      </div>
    </div>
  );
}

export function CredentialResultPanel({ result, onDone }: { result: CredentialResult; onDone: () => void }) {
  if (result.mode === "ADMIN_SET") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Share these credentials with them — this password won&apos;t be shown again.
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
          <Button onClick={onDone}>Done</Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        An email with a one-time code has been sent to <span className="font-mono">{result.email}</span> — they can
        use it to set their own password.
      </p>
      <DialogFooter>
        <Button onClick={onDone}>Done</Button>
      </DialogFooter>
    </div>
  );
}
