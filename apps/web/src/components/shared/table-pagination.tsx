"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PageSize = 25 | 50 | 75 | 100 | "all";

const PAGE_SIZE_OPTIONS: { value: string; label: string }[] = [
  { value: "25", label: "25 / page" },
  { value: "50", label: "50 / page" },
  { value: "75", label: "75 / page" },
  { value: "100", label: "100 / page" },
  { value: "all", label: "All" },
];

interface TablePaginationProps {
  page: number;
  pageSize: PageSize;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
}

// A search term is just another server-side filter alongside page/pageSize
// (see use-server-paginated.ts) — it narrows `total` and this component
// never slices a client-held array, so a match on any page is always
// reachable, never hidden behind "page 1 of the old unfiltered set."
export function TablePagination({ page, pageSize, total, onPageChange, onPageSizeChange }: TablePaginationProps) {
  const totalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : pageSize === "all" ? 1 : (page - 1) * pageSize + 1;
  const to = pageSize === "all" ? total : Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
      <p className="text-sm text-muted-foreground tabular-nums">
        {total === 0 ? "No records" : `Showing ${from}–${to} of ${total}`}
      </p>
      <div className="flex items-center gap-3">
        <div className="w-32">
          <Select
            items={PAGE_SIZE_OPTIONS}
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(v === "all" ? "all" : (Number(v) as PageSize))}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {pageSize !== "all" && totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button
              size="icon-sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-20 px-1 text-center text-sm tabular-nums text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              size="icon-sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
