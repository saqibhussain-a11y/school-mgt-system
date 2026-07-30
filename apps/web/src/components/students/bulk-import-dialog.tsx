"use client";

import { useState, type FormEvent } from "react";
import { Upload } from "lucide-react";
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

interface ImportResult {
  imported: number;
  students: { admissionNo: string; email: string; temporaryPassword: string }[];
}

export function BulkImportDialog({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
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

  function reset() {
    setFile(null);
    setResult(null);
    setError(null);
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk import students</DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              Imported <span className="font-medium">{result.imported}</span> students. Save
              these temporary passwords — they won&apos;t be shown again.
            </p>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-muted-foreground">
                  <tr>
                    <th className="p-2">Admission no.</th>
                    <th className="p-2">Email</th>
                    <th className="p-2">Password</th>
                  </tr>
                </thead>
                <tbody>
                  {result.students.map((s) => (
                    <tr key={s.admissionNo} className="border-t border-border">
                      <td className="p-2">{s.admissionNo}</td>
                      <td className="p-2 font-mono">{s.email}</td>
                      <td className="p-2 font-mono">{s.temporaryPassword}</td>
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
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              CSV columns: <code className="font-mono text-xs">email, firstName, lastName,
              admissionNo, classId, sectionId, dob</code>. Leave <code className="font-mono text-xs">admissionNo</code>{" "}
              blank to auto-assign one — only fill it in if you&apos;re migrating numbers from an
              existing system. The whole file is imported as one batch — a single bad row cancels
              the entire import.
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
                {submitting ? "Importing…" : "Import"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
