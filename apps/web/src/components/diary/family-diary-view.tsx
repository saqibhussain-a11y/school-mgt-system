"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, UserRound } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TablePagination } from "@/components/shared/table-pagination";
import { useApi } from "@/lib/use-api";
import { useServerPagination } from "@/lib/use-server-pagination";
import { apiFetch, ApiError } from "@/lib/api-client";
import { DiaryEntryCard } from "./diary-entry-card";
import type { FamilyDiaryEntry, Paginated } from "./types";

interface DashboardResponse {
  role: string;
  widgets: {
    studentId?: string | null;
    children?: { studentId: string; name: string }[];
  };
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="py-10 text-center text-sm text-muted-foreground">{children}</CardContent>
    </Card>
  );
}

function StudentFeed({ studentId, isParent }: { studentId: string; isParent: boolean }) {
  const { page, setPage, pageSize, setPageSize } = useServerPagination(studentId);
  const { data, loading, refetch } = useApi<Paginated<FamilyDiaryEntry>>(
    `/api/diary/student/${studentId}?page=${page}&pageSize=${pageSize}`,
  );
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  async function acknowledge(id: string) {
    setAcknowledging(id);
    try {
      await apiFetch(`/api/diary/${id}/acknowledge`, { method: "POST" });
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to mark as seen");
    } finally {
      setAcknowledging(null);
    }
  }

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
    );
  }
  if (!data || data.data.length === 0) return <Empty>No diary notes yet.</Empty>;

  return (
    <div className="flex flex-col gap-4">
      {data.data.map((entry) => (
        <DiaryEntryCard
          key={entry.id}
          date={entry.date}
          author={entry.createdBy}
          content={entry.content}
          photoUrl={entry.photoUrl}
          badge={
            entry.isPersonal && (
              <Badge variant="secondary" className="gap-1">
                <UserRound className="size-3" />
                Personal note
              </Badge>
            )
          }
          footer={
            isParent && (
              <div className="flex items-center justify-end border-t pt-2">
                {entry.acknowledged ? (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Check className="size-3.5" />
                    Seen
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={acknowledging === entry.id}
                    onClick={() => acknowledge(entry.id)}
                  >
                    <Check className="size-4" />
                    {acknowledging === entry.id ? "Saving…" : "Mark as seen"}
                  </Button>
                )}
              </div>
            )
          }
        />
      ))}
      <Card className="py-0">
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={data.total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </Card>
    </div>
  );
}

export function FamilyDiaryView() {
  const { data, loading } = useApi<DashboardResponse>("/api/dashboard");
  const [pickedChild, setSelectedChild] = useState("");
  const children = data?.widgets.children ?? [];
  const selectedChild = pickedChild || children[0]?.studentId || "";

  const isParent = data?.role === "PARENT";

  return (
    <div>
      <PageHeader
        title="Diary"
        description={isParent ? "Daily notes from your child's teachers" : "Daily notes from your teachers"}
      />
      {loading || !data ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : data.role === "STUDENT" ? (
        data.widgets.studentId ? (
          <StudentFeed studentId={data.widgets.studentId} isParent={false} />
        ) : (
          <Empty>No student profile linked to this account yet.</Empty>
        )
      ) : children.length === 0 ? (
        <Empty>No children are linked to your account yet.</Empty>
      ) : (
        <div className="flex flex-col gap-4">
          {children.length > 1 && (
            <div className="w-full sm:w-64">
              <Select
                items={children.map((c) => ({ value: c.studentId, label: c.name }))}
                value={selectedChild}
                onValueChange={(v) => setSelectedChild(v ?? "")}
              >
                <SelectTrigger className="w-full" aria-label="Child">
                  <SelectValue placeholder="Select child" />
                </SelectTrigger>
                <SelectContent>
                  {children.map((c) => (
                    <SelectItem key={c.studentId} value={c.studentId}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {selectedChild && <StudentFeed studentId={selectedChild} isParent />}
        </div>
      )}
    </div>
  );
}
