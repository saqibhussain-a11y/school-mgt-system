"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useApi } from "@/lib/use-api";
import { formatRole } from "@/lib/format";
import { MODULE_LABELS, type ModuleKey } from "@/lib/modules";
import type { UserRole } from "@sms/shared-types";

interface ModuleAccessInfo {
  key: ModuleKey;
  enabled: boolean;
  ceilingRoles: UserRole[];
  effectiveRoles: UserRole[];
}

interface ModuleAccessSummary {
  canCustomize: boolean;
  modules: ModuleAccessInfo[];
}

function ModuleRoleEditor({
  module,
  canCustomize,
  onSaved,
}: {
  module: ModuleAccessInfo;
  canCustomize: boolean;
  onSaved: () => void;
}) {
  const [roles, setRoles] = useState<UserRole[]>(module.effectiveRoles);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify([...roles].sort()) !== JSON.stringify([...module.effectiveRoles].sort());

  useEffect(() => {
    setRoles(module.effectiveRoles);
  }, [module.effectiveRoles]);

  function toggle(role: UserRole, checked: boolean) {
    if (role === "SCHOOL_ADMIN") return;
    setRoles((prev) => (checked ? [...prev, role] : prev.filter((r) => r !== role)));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await apiFetch("/api/schools/me/module-access", {
        method: "PATCH",
        body: JSON.stringify({ module: module.key, roles }),
      });
      toast.success(`${MODULE_LABELS[module.key]} access updated`);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update module access");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {module.ceilingRoles.map((role) => (
          <label key={role} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={role === "SCHOOL_ADMIN" || roles.includes(role)}
              disabled={!canCustomize || role === "SCHOOL_ADMIN" || saving}
              onCheckedChange={(v) => toggle(role, v === true)}
            />
            {formatRole(role)}
          </label>
        ))}
      </div>
      {canCustomize && (
        <div>
          <Button size="sm" variant="outline" disabled={!dirty || saving} onClick={handleSave}>
            {saving ? "Saving…" : "Save access"}
          </Button>
        </div>
      )}
    </div>
  );
}

export function FeatureModulesTab() {
  const { data, loading, refetch } = useApi<ModuleAccessSummary>("/api/schools/me/module-access");

  if (loading || !data) {
    return <Skeleton className="h-64 rounded-xl" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature modules</CardTitle>
        <CardDescription>
          {data.canCustomize
            ? "Optional features turned on or off by the platform administrator. For an enabled module, choose which roles at your school can see it."
            : "Optional features turned on or off for your school by the platform administrator."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {data.modules.map((module) => (
          <div key={module.key} className="flex flex-col gap-2">
            <Badge variant={module.enabled ? "default" : "outline"} className="w-fit">
              {MODULE_LABELS[module.key]} · {module.enabled ? "Enabled" : "Not enabled"}
            </Badge>
            {module.enabled && (
              <ModuleRoleEditor module={module} canCustomize={data.canCustomize} onSaved={refetch} />
            )}
          </div>
        ))}
        {!data.canCustomize && data.modules.some((m) => m.enabled) && (
          <p className="text-xs text-muted-foreground">
            Upgrade your plan to choose which roles can access each enabled module.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
