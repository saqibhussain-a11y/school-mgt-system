"use client";

import { useState, type FormEvent, type ReactElement } from "react";
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
import { apiFetch, ApiError } from "@/lib/api-client";
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, type DocumentType } from "./types";

export function GenerateCertificateDialog({
  trigger,
  studentId,
  onGenerated,
}: {
  trigger: ReactElement;
  studentId: string;
  onGenerated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<DocumentType | "">("");
  const [purpose, setPurpose] = useState("");
  const [reason, setReason] = useState("");
  const [conduct, setConduct] = useState("");
  const [leavingDate, setLeavingDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setType("");
    setPurpose("");
    setReason("");
    setConduct("");
    setLeavingDate("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!type) return;
    setSubmitting(true);
    try {
      const document = await apiFetch<{ id: string }>("/api/documents/generate", {
        method: "POST",
        body: JSON.stringify({
          studentId,
          type,
          fields: {
            purpose: purpose || undefined,
            reason: reason || undefined,
            conduct: conduct || undefined,
            leavingDate: leavingDate || undefined,
          },
        }),
      });
      const { url } = await apiFetch<{ url: string }>(`/api/documents/${document.id}/download-url`);
      window.open(url, "_blank");
      toast.success("Certificate generated");
      setOpen(false);
      reset();
      onGenerated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to generate certificate");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate certificate</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Certificate type</Label>
            <Select
              items={DOCUMENT_TYPES.map((t) => ({ value: t, label: DOCUMENT_TYPE_LABELS[t] }))}
              value={type}
              onValueChange={(v) => setType((v as DocumentType) ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {DOCUMENT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(type === "bonafide" || type === "character_certificate") && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="gc-purpose">Purpose (optional)</Label>
              <Input
                id="gc-purpose"
                placeholder="e.g. passport application"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>
          )}

          {type === "transfer_certificate" && (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="gc-leaving">Date of leaving</Label>
                <Input
                  id="gc-leaving"
                  type="date"
                  value={leavingDate}
                  onChange={(e) => setLeavingDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="gc-reason">Reason for leaving</Label>
                <Textarea id="gc-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
            </>
          )}

          {(type === "transfer_certificate" || type === "character_certificate") && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="gc-conduct">Conduct remark</Label>
              <Input
                id="gc-conduct"
                placeholder={type === "transfer_certificate" ? "e.g. Satisfactory" : "e.g. Good"}
                value={conduct}
                onChange={(e) => setConduct(e.target.value)}
              />
            </div>
          )}

          <DialogFooter>
            <Button type="submit" disabled={!type || submitting}>
              {submitting ? "Generating…" : "Generate & download"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
