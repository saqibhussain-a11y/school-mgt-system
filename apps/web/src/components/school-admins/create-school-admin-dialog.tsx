"use client";

import { useState, type FormEvent } from "react";
import { Plus, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiFetch, ApiError } from "@/lib/api-client";

const EMPTY_FORM = { firstName: "", lastName: "", email: "" };

export function CreateSchoolAdminDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(
    null,
  );

  function reset() {
    setForm(EMPTY_FORM);
    setCredentials(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const admin = await apiFetch<{ email: string; temporaryPassword?: string }>(
        "/api/auth/register",
        { method: "POST", body: JSON.stringify({ ...form, role: "SCHOOL_ADMIN" }) },
      );
      toast.success("School admin created");
      if (admin.temporaryPassword) {
        setCredentials({ email: admin.email, password: admin.temporaryPassword });
      } else {
        setOpen(false);
        reset();
      }
      onCreated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create school admin");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" />
        New school admin
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New school admin</DialogTitle>
        </DialogHeader>

        {credentials ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Share these credentials — this password won&apos;t be shown again.
            </p>
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Email</span>
                <span className="font-mono">{credentials.email}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Temporary password</span>
                <span className="flex items-center gap-2 font-mono">
                  {credentials.password}
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(credentials.password);
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
              <Button
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="sa-firstName">First name</Label>
                <Input
                  id="sa-firstName"
                  required
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="sa-lastName">Last name</Label>
                <Input
                  id="sa-lastName"
                  required
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="sa-email">Email</Label>
              <Input
                id="sa-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating…" : "Create school admin"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
