import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";

interface TableSkeletonProps {
  columns: number;
  rows?: number;
}

// Rendered inside the real <Table>/<TableHeader> so column headers and
// filters stay visible while data loads, instead of the old pattern of
// swapping the whole card for one big placeholder block — the shape of
// what's coming is visible immediately, not just "something is loading."
export function TableSkeleton({ columns, rows = 8 }: TableSkeletonProps) {
  return (
    <TableBody>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columns }).map((__, colIndex) => (
            <TableCell key={colIndex}>
              <Skeleton className="h-4 w-full max-w-40" style={{ animationDelay: `${(rowIndex * columns + colIndex) * 15}ms` }} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  );
}
