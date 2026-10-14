"use client";

import { useRef, useState, type FormEvent, type ReactElement } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { StudentSummary } from "@/components/students/types";
import { todayInputValue, type DiarySection } from "./types";

const WHOLE_SECTION = "__section__";
const MAX_LENGTH = 2000;

export function CreateDiaryEntryDialog({
  section,
  trigger,
  onSaved,
}: {
  section: DiarySection;
  trigger: ReactElement;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayInputValue);
  const [recipient, setRecipient] = useState(WHOLE_SECTION);
  const [content, setContent] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const { data: students } = useApi<StudentSummary[]>(open ? `/api/students?sectionId=${section.id}` : null);
  const recipientOptions = [
    { value: WHOLE_SECTION, label: `Whole section (${section.className} – ${section.name})` },
    ...(students ?? [])
      .filter((s) => s.status === "ACTIVE")
      .map((s) => ({ value: s.id, label: `${s.user.firstName} ${s.user.lastName} (${s.admissionNo})` })),
  ];

  function reset() {
    setDate(todayInputValue());
    setRecipient(WHOLE_SECTION);
    setContent("");
    setPhoto(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("sectionId", section.id);
      form.append("date", date);
      form.append("content", content);
      if (recipient !== WHOLE_SECTION) form.append("studentId", recipient);
      if (photo) form.append("photo", photo);
      await apiFetch("/api/diary", { method: "POST", body: form });
      toast.success(recipient === WHOLE_SECTION ? "Diary note posted to the section" : "Personal note sent");
      setOpen(false);
      reset();
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to post diary note");
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
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            New diary note · {section.className} – {section.name}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
            <div className="flex flex-col gap-2">
              <Label htmlFor="diary-date">Date</Label>
              <Input id="diary-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <Label>Send to</Label>
              <Select items={recipientOptions} value={recipient} onValueChange={(v) => setRecipient(v ?? WHOLE_SECTION)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {recipientOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="diary-content">Note</Label>
            <Textarea
              id="diary-content"
              rows={5}
              required
              maxLength={MAX_LENGTH}
              placeholder="What happened in class today, homework, reminders for parents…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <span className="self-end text-xs text-muted-foreground tabular-nums">
              {content.length}/{MAX_LENGTH}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="diary-photo">Photo (optional)</Label>
            <Input
              id="diary-photo"
              ref={photoInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />
            <span className="text-xs text-muted-foreground">JPG, PNG, or WEBP, up to 5 MB.</span>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting || !content.trim()}>
              {submitting ? "Posting…" : "Post note"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
