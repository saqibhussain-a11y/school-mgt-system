"use client";

import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useApi } from "@/lib/use-api";

interface AdmissionNumberFormat {
  prefix: string;
  nextNumber: number;
  padWidth: number;
}

export function AdmissionNumberFormatTab() {
  const { data: current, loading, refetch } = useApi<AdmissionNumberFormat>("/api/admission-number-format");
  const [form, setForm] = useState<AdmissionNumberFormat | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (current) setForm(current);
  }, [current]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      await apiFetch("/api/admission-number-format", { method: "PATCH", body: JSON.stringify(form) });
      toast.success("Admission number format saved");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save admission number format");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !form) {
    return <Skeleton className="h-48 rounded-xl" />;
  }

  const preview = `${form.prefix}${String(form.nextNumber).padStart(form.padWidth, "0")}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admission number format</CardTitle>
        <CardDescription>
          Controls the auto-generated admission number for every new student — used at admission and bulk
          import.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="anf2-prefix">Prefix</Label>
            <Input
              id="anf2-prefix"
              value={form.prefix}
              onChange={(e) => setForm({ ...form, prefix: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="anf2-next">Next number</Label>
              <Input
                id="anf2-next"
                type="number"
                min={1}
                value={form.nextNumber}
                onChange={(e) => setForm({ ...form, nextNumber: Number(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="anf2-pad">Zero-pad width</Label>
              <Input
                id="anf2-pad"
                type="number"
                min={1}
                max={10}
                value={form.padWidth}
                onChange={(e) => setForm({ ...form, padWidth: Number(e.target.value) })}
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Next admission number will be <span className="font-mono font-medium text-foreground">{preview}</span>
          </p>
          <div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
