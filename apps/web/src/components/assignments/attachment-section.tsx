"use client";

import { useRef, useState } from "react";
import { Download, Paperclip, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiError } from "@/lib/api-client";

export function AttachmentSection({
  assignmentId,
  attachmentFilename,
  canManage,
  onUploaded,
}: {
  assignmentId: string;
  attachmentFilename: string | null;
  canManage: boolean;
  onUploaded: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const { url } = await apiFetch<{ url: string }>(`/api/assignments/${assignmentId}/attachment-url`);
      window.open(url, "_blank");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to get download link");
    } finally {
      setDownloading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await apiFetch(`/api/assignments/${assignmentId}/attachment`, { method: "POST", body: formData });
      toast.success("Attachment uploaded");
      onUploaded();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to upload attachment");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {attachmentFilename ? (
        <Button size="sm" variant="outline" disabled={downloading} onClick={handleDownload}>
          <Download className="size-3.5" />
          {attachmentFilename}
        </Button>
      ) : (
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Paperclip className="size-3.5" />
          No attachment
        </span>
      )}
      {canManage && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            size="sm"
            variant="ghost"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-3.5" />
            {uploading ? "Uploading…" : attachmentFilename ? "Replace" : "Add attachment"}
          </Button>
        </>
      )}
    </div>
  );
}
