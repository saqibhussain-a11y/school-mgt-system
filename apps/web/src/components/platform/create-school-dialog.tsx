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

const EMPTY_FORM = { name: "", subdomain: "", adminEmail: "", adminFirstName: "", adminLastName: "" };

export function CreateSchoolDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);

  function reset() {
    setForm(EMPTY_FORM);
    setCredentials(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const school = await apiFetch<{ adminEmail: string; adminTemporaryPassword: string }>(
        "/api/platform/schools",
        { method: "POST", body: JSON.stringify(form) },
      );
      toast.success("School created");
      setCredentials({ email: school.adminEmail, password: school.adminTemporaryPassword });
      onCreated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create school");
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
        New school
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New school</DialogTitle>
        </DialogHeader>

        {credentials ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Share these credentials with the school&apos;s admin — this password won&apos;t be shown again.
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="sch-name">School name</Label>
              <Input
                id="sch-name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="sch-subdomain">Subdomain</Label>
              <Input
                id="sch-subdomain"
                required
                placeholder="e.g. greenwood"
                value={form.subdomain}
                onChange={(e) => setForm({ ...form, subdomain: e.target.value.toLowerCase() })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="sch-admin-first">Admin first name</Label>
                <Input
                  id="sch-admin-first"
                  required
                  value={form.adminFirstName}
                  onChange={(e) => setForm({ ...form, adminFirstName: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="sch-admin-last">Admin last name</Label>
                <Input
                  id="sch-admin-last"
                  required
                  value={form.adminLastName}
                  onChange={(e) => setForm({ ...form, adminLastName: e.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="sch-admin-email">Admin email</Label>
              <Input
                id="sch-admin-email"
                type="email"
                required
                value={form.adminEmail}
                onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating…" : "Create school"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
