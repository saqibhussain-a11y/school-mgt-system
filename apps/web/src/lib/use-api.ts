"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiError } from "./api-client";

// Same-path GET requests are deduped/cached in an app-lifetime in-memory
// map — with ~45 call sites depending on this hook, switching between Base
// UI Tabs (which unmount inactive TabsContent) used to refetch from
// scratch every time a tab was revisited. A short staleness window means
// the common "flip back and forth" case reads from cache instead of
// hitting the network again; anything genuinely stale still refetches.
// Not full stale-while-revalidate — deliberately simple: fresh means
// "skip the fetch entirely," not "show cached data while quietly
// refreshing," since every mutation-driven reload already goes through
// the explicit force-refetch path below.
const STALE_TIME_MS = 30_000;

const cache = new Map<string, { data: unknown; timestamp: number }>();
const inFlight = new Map<string, Promise<unknown>>();

// Cleared on login/logout (see auth-context.tsx) — cache keys are bare
// paths, not scoped by which user/school is asking (that's implicit in the
// JWT the server reads), so a cached entry must never survive a change of
// who's logged in.
export function clearApiCache() {
  cache.clear();
  inFlight.clear();
}

function isFresh(path: string) {
  const entry = cache.get(path);
  return !!entry && Date.now() - entry.timestamp < STALE_TIME_MS;
}

// Concurrent mounts requesting the same path (e.g. two components reading
// the same list on the same page) share one in-flight request instead of
// firing it twice.
function fetchDeduped<T>(path: string): Promise<T> {
  const existing = inFlight.get(path) as Promise<T> | undefined;
  if (existing) return existing;
  const promise = apiFetch<T>(path).then((data) => {
    cache.set(path, { data, timestamp: Date.now() });
    return data;
  });
  promise.finally(() => inFlight.delete(path));
  inFlight.set(path, promise);
  return promise;
}

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(() => (path && isFresh(path) ? (cache.get(path)!.data as T) : null));
  const [loading, setLoading] = useState(() => !!path && !isFresh(path));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (force: boolean) => {
      if (!path) return;
      if (!force && isFresh(path)) {
        setData(cache.get(path)!.data as T);
        setLoading(false);
        setError(null);
        return;
      }
      if (force) cache.delete(path);
      setLoading(true);
      setError(null);
      fetchDeduped<T>(path)
        .then(setData)
        .catch((err) => setError(err instanceof ApiError ? err.message : "Something went wrong"))
        .finally(() => setLoading(false));
    },
    [path],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  // The refetch every call site already uses after a create/edit/delete —
  // must always hit the network, never silently serve a stale cached
  // response for what's supposed to be a confirmed-fresh reload.
  const refetch = useCallback(() => load(true), [load]);

  return { data, loading, error, refetch };
}
