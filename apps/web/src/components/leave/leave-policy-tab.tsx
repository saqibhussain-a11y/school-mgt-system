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

interface LeavePolicy {
  sickDays: number;
  casualDays: number;
  otherDays: number;
}

const FIELDS: { key: keyof LeavePolicy; label: string }[] = [
  { key: "sickDays", label: "Sick leave" },
  { key: "casualDays", label: "Casual leave" },
  { key: "otherDays", label: "Other leave" },
];

export function LeavePolicyTab() {
  const { data: policy, loading, refetch } = useApi<LeavePolicy>("/api/leave-policy");
  const [values, setValues] = useState<LeavePolicy | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (policy) setValues(policy);
  }, [policy]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!values) return;
    setSaving(true);
    try {
      await apiFetch("/api/leave-policy", { method: "PATCH", body: JSON.stringify(values) });
      toast.success("Leave policy updated");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update leave policy");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !values) {
    return <Skeleton className="h-48 rounded-xl" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Annual leave entitlement</CardTitle>
        <CardDescription>
          Days per year each staff member can take, by leave type. Applies to every staff member
          at this school.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {FIELDS.map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-2">
                <Label htmlFor={`lp-${key}`}>{label}</Label>
                <Input
                  id={`lp-${key}`}
                  type="number"
                  min={0}
                  max={365}
                  required
                  value={values[key]}
                  onChange={(e) =>
                    setValues({ ...values, [key]: e.target.value === "" ? 0 : Number(e.target.value) })
                  }
                />
              </div>
            ))}
          </div>
          <div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save policy"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
