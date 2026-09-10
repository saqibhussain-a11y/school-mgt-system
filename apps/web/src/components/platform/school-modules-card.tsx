"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { platformApiFetch } from "@/lib/platform-api-client";
import { ApiError } from "@/lib/api-client";
import { MODULE_KEYS, MODULE_LABELS, type ModuleKey } from "./types";

export function SchoolModulesCard({
  schoolId,
  enabledModules,
  onChanged,
}: {
  schoolId: string;
  enabledModules: string[];
  onChanged: () => void;
}) {
  const [submitting, setSubmitting] = useState<ModuleKey | null>(null);

  async function toggle(moduleKey: ModuleKey, next: boolean) {
    const nextModules = next
      ? [...enabledModules, moduleKey]
      : enabledModules.filter((m) => m !== moduleKey);
    setSubmitting(moduleKey);
    try {
      await platformApiFetch(`/api/platform/schools/${schoolId}/modules`, {
        method: "PATCH",
        body: JSON.stringify({ enabledModules: nextModules }),
      });
      toast.success(`${MODULE_LABELS[moduleKey]} ${next ? "enabled" : "disabled"} for this school`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update modules");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature modules</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Optional features this school has access to. Off by default — turn one on once it&apos;s ready
          for them.
        </p>
        {MODULE_KEYS.map((key) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={enabledModules.includes(key)}
              disabled={submitting === key}
              onCheckedChange={(v) => toggle(key, v === true)}
            />
            {MODULE_LABELS[key]}
          </label>
        ))}
      </CardContent>
    </Card>
  );
}
