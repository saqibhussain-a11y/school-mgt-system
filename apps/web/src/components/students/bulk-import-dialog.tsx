"use client";

import { useState, type FormEvent } from "react";
import { Upload } from "lucide-react";
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
import { AdmissionNumberFormatDialog } from "@/components/students/admission-number-format-dialog";

const KNOWN_FIELDS = [
  { value: "email", label: "Email" },
  { value: "firstName", label: "First name" },
  { value: "lastName", label: "Last name" },
  { value: "admissionNo", label: "Admission no." },
  { value: "className", label: "Class" },
  { value: "sectionName", label: "Section" },
  { value: "dob", label: "Date of birth" },
  { value: "previousSchool", label: "Previous school" },
  { value: "medicalInfo", label: "Medical info" },
];
const KEEP_AS_EXTRA = "__extra__";

interface PreviewResult {
  headers: string[];
  suggestedMapping: Record<string, string | null>;
  rowCount: number;
  sampleRows: Record<string, string>[];
}

interface ImportResult {
  imported: number;
  students: { admissionNo: string; email: string }[];
  suggestedFormat: { prefix: string; nextNumber: number; padWidth: number } | null;
}

export function BulkImportDialog({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ImportResult | null>(null);

  function reset() {
    setFile(null);
    setError(null);
    setPreview(null);
    setMapping({});
    setResult(null);
  }

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiFetch<PreviewResult>("/api/students/bulk-import/preview", {
        method: "POST",
        body: formData,
      });
      setPreview(res);
      setMapping(
        Object.fromEntries(res.headers.map((h) => [h, res.suggestedMapping[h] ?? KEEP_AS_EXTRA])),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to read CSV");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmImport() {
    if (!file) return;
    setSubmitting(true);
    setError(null);
    try {
      const finalMapping = Object.fromEntries(
        Object.entries(mapping).map(([header, target]) => [header, target === KEEP_AS_EXTRA ? null : target]),
      );
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mapping", JSON.stringify(finalMapping));
      const res = await apiFetch<ImportResult>("/api/students/bulk-import", {
        method: "POST",
        body: formData,
      });
      setResult(res);
      toast.success(`Imported ${res.imported} students`);
      onImported();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Import failed");
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
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Upload className="size-4" />
        Bulk import
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk import students</DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              Imported <span className="font-medium">{result.imported}</span> students. No login access has been
              issued yet — use &quot;Generate credentials&quot; on each student&apos;s profile when they&apos;re
              ready to log in.
            </p>
            {result.suggestedFormat && (
              <div className="rounded-lg border border-border bg-muted p-3">
                <p className="mb-2 text-sm text-muted-foreground">
                  We spotted a numbering pattern in this import — want to set it as your admission number format?
                </p>
                <AdmissionNumberFormatDialog suggestedOverride={result.suggestedFormat} hideTrigger />
              </div>
            )}
            <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-muted-foreground">
                  <tr>
                    <th className="p-2">Admission no.</th>
                    <th className="p-2">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {result.students.map((s) => (
                    <tr key={s.admissionNo} className="border-t border-border">
                      <td className="p-2">{s.admissionNo}</td>
                      <td className="p-2 font-mono">{s.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
        ) : preview ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {preview.rowCount} rows detected. Map each column to a field — anything left as &quot;Keep as extra
              info&quot; is still saved with the student, just not searchable. This mapping is remembered for your
              next import.
            </p>
            <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-muted-foreground">
                  <tr>
                    <th className="p-2">CSV column</th>
                    <th className="p-2">Sample value</th>
                    <th className="p-2">Maps to</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.headers.map((header) => (
                    <tr key={header} className="border-t border-border">
                      <td className="p-2 font-medium">{header}</td>
                      <td className="p-2 text-muted-foreground">{preview.sampleRows[0]?.[header] ?? ""}</td>
                      <td className="p-2">
                        <Select
                          items={[{ value: KEEP_AS_EXTRA, label: "Keep as extra info" }, ...KNOWN_FIELDS]}
                          value={mapping[header] ?? KEEP_AS_EXTRA}
                          onValueChange={(v) => setMapping({ ...mapping, [header]: v ?? KEEP_AS_EXTRA })}
                        >
                          <SelectTrigger className="h-8 w-44">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={KEEP_AS_EXTRA}>Keep as extra info</SelectItem>
                            {KNOWN_FIELDS.map((f) => (
                              <SelectItem key={f.value} value={f.value}>
                                {f.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {error && (
              <p className="max-h-32 overflow-y-auto rounded-md bg-status-critical/10 p-2 text-xs break-all text-status-critical">
                {error}
              </p>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={reset} disabled={submitting}>
                Back
              </Button>
              <Button onClick={handleConfirmImport} disabled={submitting}>
                {submitting ? "Importing…" : `Import ${preview.rowCount} students`}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleUpload} className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Upload any CSV — you&apos;ll map its columns to student fields on the next step. Credentials aren&apos;t
              issued at import time; generate them per student when they&apos;re ready to log in.
            </p>
            <div className="flex flex-col gap-2">
              <Label htmlFor="csv-file">CSV file</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                required
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {error && (
              <p className="max-h-32 overflow-y-auto rounded-md bg-status-critical/10 p-2 text-xs break-all text-status-critical">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={submitting || !file}>
                {submitting ? "Reading…" : "Next: map columns"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
