// Opt-in pagination: a list endpoint keeps returning a flat array when no
// `pageSize` is given (every dropdown/filter consumer across the app calls
// these same endpoints unpaginated and expects that exact shape — see the
// route files), and switches to a `{ data, total, page, pageSize }`
// envelope only when a table page explicitly asks to paginate. That's why
// this is keyed off `pageSize`'s presence, not folded into every call.
export const PAGE_SIZES = [25, 50, 75, 100] as const;

export interface PaginationParams {
  page: number;
  pageSize: number | "all";
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number | "all";
}

export function parsePagination(query: Record<string, unknown>): PaginationParams | null {
  const pageSizeRaw = query.pageSize;
  if (pageSizeRaw === undefined) return null;

  const page = Math.max(1, Number.parseInt((query.page as string) ?? "1", 10) || 1);
  if (pageSizeRaw === "all") return { page: 1, pageSize: "all" };

  const parsed = Number.parseInt(pageSizeRaw as string, 10);
  const pageSize = (PAGE_SIZES as readonly number[]).includes(parsed) ? parsed : 25;
  return { page, pageSize };
}

// `safetyCap` is each service's existing LIST_SAFETY_CAP — "All" still
// can't return an unbounded payload, it's "all up to the same backstop
// every unpaginated call has always had," not literally every row.
export function skipTake({ page, pageSize }: PaginationParams, safetyCap: number) {
  if (pageSize === "all") return { skip: 0, take: safetyCap };
  return { skip: (page - 1) * pageSize, take: pageSize };
}
