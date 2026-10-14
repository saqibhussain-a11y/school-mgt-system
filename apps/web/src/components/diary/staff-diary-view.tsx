"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Eye, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { TablePagination } from "@/components/shared/table-pagination";
import { useApi } from "@/lib/use-api";
import { useServerPagination } from "@/lib/use-server-pagination";
import { apiFetch, ApiError } from "@/lib/api-client";
import { CreateDiaryEntryDialog } from "./create-diary-entry-dialog";
import { EditDiaryEntryDialog } from "./edit-diary-entry-dialog";
import { DiaryEntryCard } from "./diary-entry-card";
import type { DiarySection, Paginated, StaffDiaryEntry } from "./types";

function Feed({ section, date }: { section: DiarySection; date: string }) {
  const { page, setPage, pageSize, setPageSize } = useServerPagination(`${section.id}|${date}`);
  const params = new URLSearchParams({ sectionId: section.id, page: String(page), pageSize: String(pageSize) });
  if (date) params.set("date", date);
  const { data, loading, refetch } = useApi<Paginated<StaffDiaryEntry>>(`/api/diary?${params.toString()}`);

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/api/diary/${id}`, { method: "DELETE" });
      toast.success("Diary note deleted");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete diary note");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <CreateDiaryEntryDialog
          section={section}
          onSaved={refetch}
          trigger={
            <Button size="sm">
              <Plus className="size-4" />
              New note
            </Button>
          }
        />
      </div>

      {loading && !data ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      ) : !data || data.data.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {date ? "No diary notes for this date." : "No diary notes for this section yet. Post the first one."}
          </CardContent>
        </Card>
      ) : (
        <>
          {data.data.map((entry) => (
            <DiaryEntryCard
              key={entry.id}
              date={entry.date}
              author={entry.createdBy}
              content={entry.content}
              photoUrl={entry.photoUrl}
              badge={
                entry.student ? (
                  <Badge variant="secondary" className="gap-1">
                    <UserRound className="size-3" />
                    {entry.student.firstName} {entry.student.lastName}
                  </Badge>
                ) : (
                  <Badge variant="outline">Whole section</Badge>
                )
              }
              actions={
                entry.canEdit && (
                  <>
                    <EditDiaryEntryDialog
                      entryId={entry.id}
                      initialContent={entry.content}
                      onSaved={refetch}
                      trigger={
                        <Button size="icon" variant="ghost" aria-label="Edit note">
                          <Pencil className="size-4" />
                        </Button>
                      }
                    />
                    <ConfirmDialog
                      trigger={
                        <Button size="icon" variant="ghost" aria-label="Delete note">
                          <Trash2 className="size-4" />
                        </Button>
                      }
                      title="Delete this diary note?"
                      description="Parents and students will no longer see it. This can't be undone."
                      confirmLabel="Delete"
                      destructive
                      onConfirm={() => handleDelete(entry.id)}
                    />
                  </>
                )
              }
              footer={
                <div className="flex items-center gap-1.5 border-t pt-2 text-xs text-muted-foreground">
                  <Eye className="size-3.5" />
                  {entry.recipientCount === 0
                    ? "No linked parent accounts"
                    : `Seen by ${entry.acknowledgedCount} of ${entry.recipientCount} parent${entry.recipientCount === 1 ? "" : "s"}`}
                </div>
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
        </>
      )}
    </div>
  );
}

export function StaffDiaryView() {
  const { data: sections, loading } = useApi<DiarySection[]>("/api/diary/sections");
  const [selectedSectionId, setSectionId] = useState("");
  const [date, setDate] = useState("");

  const sectionId = selectedSectionId || sections?.[0]?.id || "";
  const section = sections?.find((s) => s.id === sectionId);
  const sectionOptions = (sections ?? []).map((s) => ({ value: s.id, label: `${s.className} – ${s.name}` }));

  return (
    <div>
      <PageHeader title="Diary" description="Daily notes to students and parents, section by section" />
      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !sections || sections.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            You aren&apos;t assigned to any sections yet, so there&apos;s no diary to post to.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-64">
              <Select items={sectionOptions} value={sectionId} onValueChange={(v) => setSectionId(v ?? "")}>
                <SelectTrigger className="w-full" aria-label="Section">
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  {sectionOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              type="date"
              aria-label="Filter by date"
              className="w-44"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            {date && (
              <Button size="sm" variant="ghost" onClick={() => setDate("")}>
                Show all dates
              </Button>
            )}
          </div>
          {section && <Feed section={section} date={date} />}
        </div>
      )}
    </div>
  );
}
