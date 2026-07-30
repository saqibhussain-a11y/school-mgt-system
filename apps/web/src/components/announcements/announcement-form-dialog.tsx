"use client";

import { useEffect, useState, type FormEvent, type ReactElement } from "react";
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
import { formatRole } from "@/lib/format";
import type { UserRole } from "@sms/shared-types";
import type { AnnouncementSummary } from "@/components/dashboard/announcement-card";

const ROLE_OPTIONS: UserRole[] = [
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "PRINCIPAL",
  "TEACHER",
  "STUDENT",
  "PARENT",
  "ACCOUNTANT",
  "LIBRARIAN",
  "TRANSPORT_MANAGER",
];

const ALL = "ALL";

interface SchoolClassOption {
  id: string;
  name: string;
}

export function AnnouncementFormDialog({
  trigger,
  announcement,
  onSaved,
}: {
  trigger: ReactElement;
  announcement?: AnnouncementSummary;
  onSaved: () => void;
}) {
  const isEdit = Boolean(announcement);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetRole, setTargetRole] = useState<string>(ALL);
  const [targetClassId, setTargetClassId] = useState<string>(ALL);
  const [submitting, setSubmitting] = useState(false);

  const { data: classes } = useApi<SchoolClassOption[]>(open ? "/api/classes" : null);

  useEffect(() => {
    if (open) {
      setTitle(announcement?.title ?? "");
      setBody(announcement?.body ?? "");
      setTargetRole(announcement?.targetRole ?? ALL);
      setTargetClassId(announcement?.targetClass?.id ?? ALL);
    }
  }, [open, announcement]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isEdit && announcement) {
        await apiFetch(`/api/announcements/${announcement.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            title,
            body,
            targetRole: targetRole === ALL ? null : targetRole,
            targetClassId: targetClassId === ALL ? null : targetClassId,
          }),
        });
        toast.success("Announcement updated");
      } else {
        await apiFetch("/api/announcements", {
          method: "POST",
          body: JSON.stringify({
            title,
            body,
            ...(targetRole === ALL ? {} : { targetRole }),
            ...(targetClassId === ALL ? {} : { targetClassId }),
          }),
        });
        toast.success("Announcement created");
      }
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save announcement");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit announcement" : "New announcement"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="a-title">Title</Label>
            <Input
              id="a-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="a-body">Message</Label>
            <Textarea
              id="a-body"
              required
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Target role</Label>
              <Select
                items={[
                  { value: ALL, label: "All roles" },
                  ...ROLE_OPTIONS.map((r) => ({ value: r, label: formatRole(r) })),
                ]}
                value={targetRole}
                onValueChange={(v) => setTargetRole(v ?? ALL)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All roles</SelectItem>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {formatRole(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Target class</Label>
              <Select
                items={[
                  { value: ALL, label: "All classes" },
                  ...(classes ?? []).map((c) => ({ value: c.id, label: c.name })),
                ]}
                value={targetClassId}
                onValueChange={(v) => setTargetClassId(v ?? ALL)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All classes</SelectItem>
                  {(classes ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Create announcement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
