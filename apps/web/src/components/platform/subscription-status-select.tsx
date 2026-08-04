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
import { apiFetch, ApiError } from "@/lib/api-client";
import { SUBSCRIPTION_STATUSES, type SubscriptionStatus } from "./types";

const LABELS: Record<SubscriptionStatus, string> = {
  active: "Active",
  past_due: "Past due",
  suspended: "Suspended",
};

export function SubscriptionStatusSelect({
  schoolId,
  status,
  onChanged,
}: {
  schoolId: string;
  status: string;
  onChanged: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  async function handleChange(next: string | null) {
    if (!next || next === status) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/platform/schools/${schoolId}/subscription`, {
        method: "PATCH",
        body: JSON.stringify({ subscriptionStatus: next }),
      });
      toast.success("Subscription status updated");
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update subscription status");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Select
      items={SUBSCRIPTION_STATUSES.map((s) => ({ value: s, label: LABELS[s] }))}
      value={status}
      onValueChange={handleChange}
      disabled={submitting}
    >
      <SelectTrigger className="w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUBSCRIPTION_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
