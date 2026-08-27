"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  FIXED_FIELDS,
  labelForFieldKey,
  subjectSlotNumbers,
  type Marker,
  type ResultCardTemplate,
} from "./result-card-template-types";

export function ResultCardTemplateTab() {
  const { data: template, loading, refetch } = useApi<ResultCardTemplate | null>(
    "/api/result-card-template",
  );
  const [uploading, setUploading] = useState(false);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (template) setMarkers(template.markers);
  }, [template]);

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await apiFetch("/api/result-card-template/image", { method: "POST", body: formData });
      toast.success("Template image uploaded");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to upload image");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function addMarker(fieldKey: string) {
    setMarkers((prev) => [
      ...prev,
      { id: crypto.randomUUID(), fieldKey, xRatio: 0.5, yRatio: 0.5, fontSize: 11 },
    ]);
    setDirty(true);
  }

  function addSubjectSlot() {
    const slots = subjectSlotNumbers(markers);
    const next = slots.length > 0 ? Math.max(...slots) + 1 : 1;
    setMarkers((prev) => [
      ...prev,
      { id: crypto.randomUUID(), fieldKey: `subjectObtained:${next}`, xRatio: 0.3, yRatio: 0.5, fontSize: 11 },
      { id: crypto.randomUUID(), fieldKey: `subjectTotal:${next}`, xRatio: 0.4, yRatio: 0.5, fontSize: 11 },
    ]);
    setDirty(true);
  }

  function removeMarker(id: string) {
    setMarkers((prev) => prev.filter((m) => m.id !== id));
    setDirty(true);
  }

  function updateFontSize(id: string, fontSize: number) {
    setMarkers((prev) => prev.map((m) => (m.id === id ? { ...m, fontSize } : m)));
    setDirty(true);
  }

  useEffect(() => {
    if (!draggingId) return;
    function onMove(e: MouseEvent) {
      const rect = imageRef.current?.getBoundingClientRect();
      if (!rect) return;
      const xRatio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const yRatio = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
      setMarkers((prev) => prev.map((m) => (m.id === draggingId ? { ...m, xRatio, yRatio } : m)));
      setDirty(true);
    }
    function onUp() {
      setDraggingId(null);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [draggingId]);

  async function handleSaveMarkers() {
    setSaving(true);
    try {
      await apiFetch("/api/result-card-template/markers", {
        method: "PUT",
        body: JSON.stringify({ markers }),
      });
      toast.success("Marker positions saved");
      setDirty(false);
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save marker positions");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTemplate() {
    try {
      await apiFetch("/api/result-card-template", { method: "DELETE" });
      toast.success("Template removed");
      setMarkers([]);
      setDirty(false);
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to remove template");
    }
  }

  if (loading) return <Skeleton className="h-96 rounded-xl" />;

  const placedFieldKeys = new Set(markers.map((m) => m.fieldKey));
  const availableFixedFields = FIXED_FIELDS.filter((f) => !placedFieldKeys.has(f.key));

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Upload a scan or photo of your school&apos;s blank result card, then drag markers onto it to
          mark where each field should print — this is calibrated once and reused for every class.
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{template ? "Template image" : "Upload a template image"}</CardTitle>
          {template && (
            <ConfirmDialog
              trigger={
                <Button size="sm" variant="ghost" title="Delete template">
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              }
              title="Delete this result card template?"
              description="The image and all marker positions will be removed."
              confirmLabel="Delete"
              destructive
              onConfirm={handleDeleteTemplate}
            />
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="template-upload">{template ? "Replace image" : "Choose an image"}</Label>
            <Input
              id="template-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={handleUpload}
              className="max-w-sm"
            />
          </div>
          {template && (
            <div
              ref={imageRef}
              className="relative w-full max-w-2xl select-none overflow-hidden rounded-md border"
            >
              {/* Uploaded, admin-only template image — plain img is fine here. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={template.imageUrl}
                alt="Result card template"
                className="block w-full"
                draggable={false}
              />
              {markers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setDraggingId(m.id);
                  }}
                  className={cn(
                    "absolute flex -translate-x-1/2 -translate-y-1/2 cursor-move items-center rounded-full border-2 border-primary bg-primary/90 px-2 py-0.5 text-[10px] font-medium whitespace-nowrap text-primary-foreground shadow",
                    draggingId === m.id && "z-10 ring-2 ring-ring",
                  )}
                  style={{ left: `${m.xRatio * 100}%`, top: `${m.yRatio * 100}%` }}
                >
                  {labelForFieldKey(m.fieldKey)}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {template && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Add a field marker</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {availableFixedFields.map((f) => (
                <Button key={f.key} size="sm" variant="outline" onClick={() => addMarker(f.key)}>
                  <Plus className="size-3.5" />
                  {f.label}
                </Button>
              ))}
              <Button size="sm" variant="outline" onClick={addSubjectSlot}>
                <Plus className="size-3.5" />
                Subject slot
              </Button>
              {availableFixedFields.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  All fixed fields are placed — you can still add more subject slots.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Placed markers</CardTitle>
              <Button size="sm" disabled={!dirty || saving} onClick={handleSaveMarkers}>
                {saving ? "Saving…" : "Save positions"}
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {markers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No markers placed yet.</p>
              ) : (
                markers.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <span>{labelForFieldKey(m.fieldKey)}</span>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`fontsize-${m.id}`} className="text-xs text-muted-foreground">
                        Size
                      </Label>
                      <Input
                        id={`fontsize-${m.id}`}
                        type="number"
                        min={6}
                        max={48}
                        value={m.fontSize ?? 11}
                        onChange={(e) => updateFontSize(m.id, Number(e.target.value))}
                        className="h-7 w-16"
                      />
                      <Button size="sm" variant="ghost" onClick={() => removeMarker(m.id)} title="Remove">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
