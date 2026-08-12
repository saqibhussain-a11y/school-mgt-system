"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { reportClientError } from "@/lib/report-client-error";

// Catches a render error anywhere under the root layout (i.e. most of the
// app) — the root layout itself isn't covered, hence global-error.tsx too.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    reportClientError(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        This page hit an unexpected error. It&apos;s been logged — try again, or go back to the dashboard.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>
          Go to dashboard
        </Button>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
