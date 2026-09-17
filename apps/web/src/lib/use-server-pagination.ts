"use client";

import { useEffect, useState } from "react";
import type { PageSize } from "@/components/shared/table-pagination";

// Resets to page 1 whenever `resetKey` changes (e.g. a filter or search
// term) — otherwise "page 4" could silently persist into a narrower
// filtered result set that only has 1 page, rendering an empty table.
export function useServerPagination(resetKey: string) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(25);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  return { page, setPage, pageSize, setPageSize };
}
