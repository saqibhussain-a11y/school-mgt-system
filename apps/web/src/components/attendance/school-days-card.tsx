"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";

const DAYS = [
  { value: "MONDAY", label: "Monday" },
  { value: "TUESDAY", label: "Tuesday" },
  { value: "WEDNESDAY", label: "Wednesday" },
  { value: "THURSDAY", label: "Thursday" },
  { value: "FRIDAY", label: "Friday" },
  { value: "SATURDAY", label: "Saturday" },
];

export function SchoolDaysCard({ canManage }: { canManage: boolean }) {
  const { data: school, loading, refetch } = useApi<{ workingDays: string[] }>("/api/schools/me");
  const [edited, setEdited] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);

  if (loading || !school) return <Skeleton className="h-28 rounded-xl" />;

  const days = edited ?? school.workingDays;
  const dirty = edited !== null && [...edited].sort().join() !== [...school.workingDays].sort().join();

  function toggle(day: string, on: boolean) {
    setEdited((on ? [...days, day] : days.filter((d) => d !== day)).filter((d, i, a) => a.indexOf(d) === i));
  }

  async function save() {
    setSaving(true);
    try {
      await apiFetch("/api/schools/me", { method: "PATCH", body: JSON.stringify({ workingDays: days }) });
      toast.success("School days updated");
      setEdited(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update school days");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>School days</CardTitle>
        <CardDescription>
          Attendance can only be marked on these days, and staff aren&apos;t counted absent on the others. Sunday is
          always off.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-x-5 gap-y-3">
          {DAYS.map((day) => (
            <label key={day.value} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={days.includes(day.value)}
                disabled={!canManage || saving}
                onCheckedChange={(v) => toggle(day.value, v === true)}
              />
              {day.label}
            </label>
          ))}
        </div>
        {canManage && (
          <div className="flex items-center gap-3">
            <Button size="sm" disabled={!dirty || saving || days.length === 0} onClick={save}>
              {saving ? "Saving…" : "Save school days"}
            </Button>
            {days.length === 0 && <span className="text-xs text-destructive">Pick at least one day.</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
