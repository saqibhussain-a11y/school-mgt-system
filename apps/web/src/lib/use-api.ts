"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiError } from "./api-client";

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    if (!path) return;
    setLoading(true);
    setError(null);
    apiFetch<T>(path)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Something went wrong"))
      .finally(() => setLoading(false));
  }, [path]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
