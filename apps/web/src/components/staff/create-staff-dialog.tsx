"use client";

import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
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
import { apiFetch, ApiError } from "@/lib/api-client";
import { CredentialModeField, CredentialResultPanel, type CredentialMode, type CredentialResult } from "@/components/shared/credential-mode";

const STAFF_ROLES = ["TEACHER", "PRINCIPAL", "ACCOUNTANT", "LIBRARIAN", "TRANSPORT_MANAGER"];

const EMPTY_FORM = {
  email: "",
  firstName: "",
  lastName: "",
  role: "TEACHER",
  designation: "",
  mode: "ADMIN_SET" as CredentialMode,
};

export function CreateStaffDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CredentialResult | null>(null);

  function reset() {
    setForm(EMPTY_FORM);
    setResult(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const staff = await apiFetch<{
        user: { email: string };
        mode: CredentialMode;
        temporaryPassword?: string;
      }>("/api/staff", { method: "POST", body: JSON.stringify(form) });
      toast.success("Staff member created");
      setResult(
        staff.mode === "ADMIN_SET"
          ? { mode: "ADMIN_SET", email: staff.user.email, temporaryPassword: staff.temporaryPassword! }
          : { mode: "SELF_SERVICE", email: staff.user.email },
      );
      onCreated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create staff member");
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
        New staff member
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New staff member</DialogTitle>
        </DialogHeader>

        {result ? (
          <CredentialResultPanel
            result={result}
            onDone={() => {
              setOpen(false);
              reset();
            }}
          />
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="st-firstName">First name</Label>
                <Input
                  id="st-firstName"
                  required
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="st-lastName">Last name</Label>
                <Input
                  id="st-lastName"
                  required
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="st-email">Email</Label>
              <Input
                id="st-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label>Role</Label>
                <Select
                  items={STAFF_ROLES.map((r) => ({ value: r, label: r.replace("_", " ") }))}
                  value={form.role}
                  onValueChange={(v) => setForm({ ...form, role: v ?? "TEACHER" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAFF_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="st-designation">Designation</Label>
                <Input
                  id="st-designation"
                  placeholder="Math Teacher"
                  required
                  value={form.designation}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })}
                />
              </div>
            </div>
            <CredentialModeField mode={form.mode} onChange={(mode) => setForm({ ...form, mode })} />
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating…" : "Create staff member"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
