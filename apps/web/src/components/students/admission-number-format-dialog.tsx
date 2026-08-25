"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Settings2 } from "lucide-react";
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
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";

interface AdmissionNumberFormat {
  prefix: string;
  nextNumber: number;
  padWidth: number;
  suggested: string;
}

export function AdmissionNumberFormatDialog({
  suggestedOverride,
  hideTrigger,
  onSaved,
}: {
  // Passed after a bulk import that found a legacy pattern this school
  // hasn't customized yet — prefills the form with that guess so the admin
  // just reviews/confirms instead of typing it from scratch.
  suggestedOverride?: { prefix: string; nextNumber: number; padWidth: number } | null;
  // Used when mounted as a one-off auto-popup right after import — there's
  // no separate trigger button in that case, the dialog just opens itself.
  hideTrigger?: boolean;
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(Boolean(suggestedOverride));
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ prefix: "", nextNumber: 1, padWidth: 4 });

  const { data: current, refetch } = useApi<AdmissionNumberFormat>(open ? "/api/admission-number-format" : null);

  useEffect(() => {
    if (suggestedOverride) {
      setForm(suggestedOverride);
    } else if (current) {
      setForm({ prefix: current.prefix, nextNumber: current.nextNumber, padWidth: current.padWidth });
    }
  }, [current, suggestedOverride]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch("/api/admission-number-format", { method: "PATCH", body: JSON.stringify(form) });
      toast.success("Admission number format saved");
      setOpen(false);
      refetch();
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save admission number format");
    } finally {
      setSubmitting(false);
    }
  }

  const preview = `${form.prefix}${String(form.nextNumber).padStart(form.padWidth, "0")}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger
          render={
            <Button size="sm" variant="outline">
              <Settings2 className="size-4" />
              Admission number format
            </Button>
          }
        />
      )}
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Admission number format</DialogTitle>
        </DialogHeader>
        {suggestedOverride && (
          <p className="text-sm text-muted-foreground">
            We noticed admission numbers like this in your import — review and confirm the pattern to continue
            from here automatically next time.
          </p>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="anf-prefix">Prefix</Label>
            <Input
              id="anf-prefix"
              value={form.prefix}
              onChange={(e) => setForm({ ...form, prefix: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="anf-next">Next number</Label>
              <Input
                id="anf-next"
                type="number"
                min={1}
                value={form.nextNumber}
                onChange={(e) => setForm({ ...form, nextNumber: Number(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="anf-pad">Zero-pad width</Label>
              <Input
                id="anf-pad"
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
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
