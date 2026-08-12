const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Best-effort, fire-and-forget — a logging call must never itself throw or
// block recovery from the error it's reporting. No auth header: a crashed
// app can't guarantee a valid token, and this endpoint doesn't need one.
export function reportClientError(error: Error & { digest?: string }) {
  try {
    fetch(`${API_URL}/api/client-errors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        url: typeof window !== "undefined" ? window.location.href : undefined,
      }),
    }).catch(() => {});
  } catch {
    // Never let error reporting itself throw.
  }
}
