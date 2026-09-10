"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { MODULE_KEYS, MODULE_LABELS } from "@/lib/modules";

export function FeatureModulesTab() {
  const { user } = useAuth();
  const enabledModules = user?.enabledModules ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature modules</CardTitle>
        <CardDescription>
          Optional features turned on or off for your school by the platform administrator.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {MODULE_KEYS.map((key) => {
          const enabled = enabledModules.includes(key);
          return (
            <Badge key={key} variant={enabled ? "default" : "outline"}>
              {MODULE_LABELS[key]} · {enabled ? "Enabled" : "Not enabled"}
            </Badge>
          );
        })}
      </CardContent>
    </Card>
  );
}
