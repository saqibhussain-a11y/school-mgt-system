"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePlatformApi } from "@/lib/use-platform-api";
import { formatRelativeTime } from "@/lib/format";
import type { PlatformAuditLogEntry } from "@/components/platform/types";

export default function PlatformAuditLogPage() {
  const { data: entries, loading } = usePlatformApi<PlatformAuditLogEntry[]>("/api/platform/audit-log");

  return (
    <div>
      <PageHeader title="Audit Log" description="Every sensitive platform action, who did it, and when" />

      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !entries || entries.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No platform actions logged yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Platform admin</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell title={new Date(entry.createdAt).toLocaleString()} className="whitespace-nowrap">
                    {formatRelativeTime(entry.createdAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{entry.platformAdmin.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{entry.action}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.targetType} · {entry.targetId}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                    {entry.metadata ? JSON.stringify(entry.metadata) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
