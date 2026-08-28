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
import { ApiError } from "@/lib/api-client";
import { PLAN_LABELS, type PlanKey } from "./types";

export function PlanSelect({
  schoolId,
  plan,
  onChanged,
}: {
  schoolId: string;
  plan: string;
  onChanged: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const planKeys = Object.keys(PLAN_LABELS) as PlanKey[];

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
      items={planKeys.map((key) => ({ value: key, label: PLAN_LABELS[key] }))}
      value={plan}
      onValueChange={handleChange}
      disabled={submitting}
    >
      <SelectTrigger className="w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {planKeys.map((key) => (
          <SelectItem key={key} value={key}>
            {PLAN_LABELS[key]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
