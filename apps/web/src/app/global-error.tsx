"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/report-client-error";

// Only fires if the ROOT LAYOUT itself throws (ThemeProvider/AuthProvider/
// etc. never mounted) — error.tsx covers everything else. Must render its
// own <html>/<body> and can't assume any app context/styling is available,
// hence plain inline styles instead of Tailwind classes.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    reportClientError(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1.5rem",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ maxWidth: "28rem", fontSize: "0.875rem", color: "#666" }}>
          The application failed to load. It&apos;s been logged — try reloading the page.
        </p>
        <button
          onClick={reset}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "0.375rem",
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
