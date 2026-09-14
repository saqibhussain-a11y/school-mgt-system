"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch, ApiError } from "@/lib/api-client";

// On-demand, not automatic — an LLM call is slower and (for a paid
// provider) costlier than the report data itself, so this only fires when
// someone actually asks for a summary, never on every report page load.
export function AiSummaryCard({ path }: { path: string }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSummarize() {
    setLoading(true);
    try {
      const result = await apiFetch<{ summary: string }>(path);
      setSummary(result.summary);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to generate summary");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-3 py-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <span className="text-sm font-medium text-foreground">AI summary</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {summary ?? "Get a plain-language summary of this report."}
        </p>
        <Button size="sm" variant="outline" onClick={handleSummarize} disabled={loading}>
          {loading ? "Summarizing…" : summary ? "Regenerate" : "Summarize with AI"}
        </Button>
      </CardContent>
    </Card>
  );
}
