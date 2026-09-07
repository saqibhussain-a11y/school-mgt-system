"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { platformApiFetch } from "@/lib/platform-api-client";
import { usePlatformApi } from "@/lib/use-platform-api";
import { ApiError } from "@/lib/api-client";
import type { Plan } from "./types";

export function PlanSelect({
  schoolId,
  plan,
  onChanged,
}: {
  schoolId: string;
  plan: string;
  onChanged: () => void;
}) {
  const { data: plans } = usePlatformApi<Plan[]>("/api/platform/plans");
  const [submitting, setSubmitting] = useState(false);

  async function handleChange(next: string | null) {
    if (!next || next === plan) return;
    setSubmitting(true);
    try {
      await platformApiFetch(`/api/platform/schools/${schoolId}/subscription`, {
        method: "PATCH",
        body: JSON.stringify({ subscriptionPlan: next }),
      });
      toast.success("Plan updated");
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update plan");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Select
      items={(plans ?? []).map((p) => ({ value: p.key, label: p.label }))}
      value={plan}
      onValueChange={handleChange}
      disabled={submitting || !plans}
    >
      <SelectTrigger className="w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(plans ?? []).map((p) => (
          <SelectItem key={p.key} value={p.key}>
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
