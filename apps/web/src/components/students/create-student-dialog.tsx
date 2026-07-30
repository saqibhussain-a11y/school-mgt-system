"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Plus, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { AcademicSession } from "@/components/academics/sessions-tab";
import type { SchoolClass } from "@/components/academics/classes-tab";

interface Section {
  id: string;
  name: string;
}

const EMPTY_FORM = {
  email: "",
  firstName: "",
  lastName: "",
  admissionNo: "",
  classId: "",
  sectionId: "",
  dob: "",
  previousSchool: "",
  medicalInfo: "",
};

export function CreateStudentDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(
    null,
  );

  const { data: sessions } = useApi<AcademicSession[]>(open ? "/api/academic-sessions" : null);
  const [sessionId, setSessionId] = useState("");
  useEffect(() => {
    if (!sessionId && sessions && sessions.length > 0) setSessionId(sessions[0].id);
  }, [sessions, sessionId]);

  const { data: classes } = useApi<SchoolClass[]>(
    sessionId ? `/api/classes?academicSessionId=${sessionId}` : null,
  );
  const { data: sections } = useApi<Section[]>(
    form.classId ? `/api/sections?classId=${form.classId}` : null,
  );

  function reset() {
    setForm(EMPTY_FORM);
    setCredentials(null);
    setSessionId("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const student = await apiFetch<{ user: { email: string }; temporaryPassword?: string }>(
        "/api/students",
        { method: "POST", body: JSON.stringify(form) },
      );
      toast.success("Student created");
      if (student.temporaryPassword) {
        setCredentials({ email: student.user.email, password: student.temporaryPassword });
      } else {
        setOpen(false);
        reset();
      }
      onCreated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create student");
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
        New student
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New student</DialogTitle>
        </DialogHeader>

        {credentials ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Share these credentials with the student — this password won&apos;t be shown again.
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
                <Label htmlFor="s-firstName">First name</Label>
                <Input
                  id="s-firstName"
                  required
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="s-lastName">Last name</Label>
                <Input
                  id="s-lastName"
                  required
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="s-email">Email</Label>
              <Input
                id="s-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="s-admissionNo">Admission no.</Label>
                <Input
                  id="s-admissionNo"
                  required
                  value={form.admissionNo}
                  onChange={(e) => setForm({ ...form, admissionNo: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="s-dob">Date of birth</Label>
                <Input
                  id="s-dob"
                  type="date"
                  required
                  value={form.dob}
                  onChange={(e) => setForm({ ...form, dob: e.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Academic session</Label>
              <Select
                items={(sessions ?? []).map((s) => ({ value: s.id, label: s.name }))}
                value={sessionId}
                onValueChange={(v) => setSessionId(v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select session" />
                </SelectTrigger>
                <SelectContent>
                  {(sessions ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label>Class</Label>
                <Select
                  items={(classes ?? []).map((c) => ({ value: c.id, label: c.name }))}
                  value={form.classId}
                  onValueChange={(v) => setForm({ ...form, classId: v ?? "", sectionId: "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {(classes ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Section</Label>
                <Select
                  items={(sections ?? []).map((s) => ({ value: s.id, label: s.name }))}
                  value={form.sectionId}
                  onValueChange={(v) => setForm({ ...form, sectionId: v ?? "" })}
                  disabled={!form.classId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {(sections ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="s-previousSchool">Previous school (optional)</Label>
              <Input
                id="s-previousSchool"
                value={form.previousSchool}
                onChange={(e) => setForm({ ...form, previousSchool: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="s-medicalInfo">Medical info (optional)</Label>
              <Textarea
                id="s-medicalInfo"
                value={form.medicalInfo}
                onChange={(e) => setForm({ ...form, medicalInfo: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting || !form.classId || !form.sectionId}>
                {submitting ? "Creating…" : "Create student"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
