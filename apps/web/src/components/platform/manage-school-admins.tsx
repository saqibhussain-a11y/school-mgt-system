"use client";

import { useState, type FormEvent } from "react";
import { Plus, Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { usePlatformApi } from "@/lib/use-platform-api";
import { platformApiFetch } from "@/lib/platform-api-client";
import { ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

interface SchoolAdmin {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
}

function CredentialDisplay({ email, password }: { email: string; password: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">Email</span>
        <span className="font-mono">{email}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">Temporary password</span>
        <span className="flex items-center gap-2 font-mono">
          {password}
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(password);
              toast.success("Copied to clipboard");
            }}
            aria-label="Copy password"
          >
            <Copy className="size-3.5" />
          </button>
        </span>
      </div>
    </div>
  );
}

const EMPTY_FORM = { email: "", firstName: "", lastName: "" };

function CreateAdminDialog({ schoolId, onCreated }: { schoolId: string; onCreated: () => void }) {
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
      const admin = await platformApiFetch<{ email: string; temporaryPassword: string }>(
        `/api/platform/schools/${schoolId}/admins`,
        { method: "POST", body: JSON.stringify(form) },
      );
      toast.success("Admin created");
      setCredentials({ email: admin.email, password: admin.temporaryPassword });
      onCreated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create admin");
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
        New admin
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New school admin</DialogTitle>
        </DialogHeader>

        {credentials ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Share these credentials with the admin — this password won&apos;t be shown again.
            </p>
            <CredentialDisplay email={credentials.email} password={credentials.password} />
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
                <Label htmlFor="admin-first">First name</Label>
                <Input
                  id="admin-first"
                  required
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="admin-last">Last name</Label>
                <Input
                  id="admin-last"
                  required
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating…" : "Create admin"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordButton({ schoolId, adminId }: { schoolId: string; adminId: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleReset() {
    setSubmitting(true);
    try {
      const result = await platformApiFetch<{ temporaryPassword: string }>(
        `/api/platform/schools/${schoolId}/admins/${adminId}/reset-password`,
        { method: "POST" },
      );
      setPassword(result.temporaryPassword);
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
        if (next) handleReset();
        else setPassword(null);
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <KeyRound className="size-3.5" />
        Reset password
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
        </DialogHeader>
        {submitting || !password ? (
          <Skeleton className="h-16 rounded-lg" />
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              A new temporary password has been issued — this won&apos;t be shown again.
            </p>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted p-3 text-sm">
              <span className="font-mono">{password}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(password);
                  toast.success("Copied to clipboard");
                }}
                aria-label="Copy password"
              >
                <Copy className="size-3.5" />
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ManageSchoolAdmins({ schoolId }: { schoolId: string }) {
  const { data: admins, loading, refetch } = usePlatformApi<SchoolAdmin[]>(
    `/api/platform/schools/${schoolId}/admins`,
  );

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Admins</h3>
          <CreateAdminDialog schoolId={schoolId} onCreated={refetch} />
        </div>

        {loading ? (
          <Skeleton className="h-32 rounded-xl" />
        ) : !admins || admins.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No admins yet for this school.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell className="font-medium">
                    {admin.firstName} {admin.lastName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{admin.email}</TableCell>
                  <TableCell>{formatDate(admin.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <ResetPasswordButton schoolId={schoolId} adminId={admin.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
