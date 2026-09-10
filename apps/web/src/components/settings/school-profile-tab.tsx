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

interface SchoolProfile {
  name: string;
  address: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}

export function SchoolProfileTab() {
  const { data: profile, loading, refetch } = useApi<SchoolProfile>("/api/schools/me");
  const [values, setValues] = useState<SchoolProfile | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) setValues(profile);
  }, [profile]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!values) return;
    setSaving(true);
    try {
      await apiFetch("/api/schools/me", { method: "PATCH", body: JSON.stringify(values) });
      toast.success("School profile updated");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update school profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !values) {
    return <Skeleton className="h-64 rounded-xl" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>School profile</CardTitle>
        <CardDescription>
          Basic details about your school. Shown on generated documents and used to reach you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="sp-name">School name</Label>
            <Input
              id="sp-name"
              required
              value={values.name}
              onChange={(e) => setValues({ ...values, name: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sp-address">Address</Label>
            <Input
              id="sp-address"
              value={values.address ?? ""}
              onChange={(e) => setValues({ ...values, address: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="sp-email">Contact email</Label>
              <Input
                id="sp-email"
                type="email"
                value={values.contactEmail ?? ""}
                onChange={(e) => setValues({ ...values, contactEmail: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="sp-phone">Contact phone</Label>
              <Input
                id="sp-phone"
                value={values.contactPhone ?? ""}
                onChange={(e) => setValues({ ...values, contactPhone: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
