"use client";

import { useCallback, useEffect, useState } from "react";
import { platformApiFetch } from "./platform-api-client";
import { ApiError } from "./api-client";

export function usePlatformApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!path) return;
    setLoading(true);
    setError(null);
    platformApiFetch<T>(path)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Something went wrong"))
      .finally(() => setLoading(false));
  }, [path]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refetch: load };
}
