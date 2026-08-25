"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ChaptersPanel } from "@/components/curriculum/chapters-panel";
import { SchedulePanel } from "@/components/curriculum/schedule-panel";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { SyllabusDetail } from "@/components/curriculum/types";

const MANAGE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"];

export default function SyllabusDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const canManage = !!user && MANAGE_ROLES.includes(user.role);

  const { data: syllabus, loading, refetch } = useApi<SyllabusDetail>(`/api/syllabuses/${params.id}`);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);

  async function handleDeleteSyllabus() {
    try {
      await apiFetch(`/api/syllabuses/${params.id}`, { method: "DELETE" });
      toast.success("Syllabus removed");
      router.push("/dashboard/curriculum");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to remove syllabus");
    }
  }

  if (loading || !syllabus) {
    return <Skeleton className="h-64 rounded-xl" />;
  }

  const selectedChapter = syllabus.chapters.find((c) => c.id === selectedChapterId) ?? null;

  return (
    <div>
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => router.push("/dashboard/curriculum")}>
              <ArrowLeft className="size-4" />
            </Button>
            {syllabus.class.name} — {syllabus.subject.name}
          </div>
        }
        description={`Academic session: ${syllabus.academicSession.name}`}
        action={
          canManage && (
            <ConfirmDialog
              trigger={
                <Button size="sm" variant="outline">
                  <Trash2 className="size-3.5" />
                  Delete syllabus
                </Button>
              }
              title="Delete this syllabus?"
              description="All its chapters and scheduled dates will be removed too."
              confirmLabel="Delete"
              destructive
              onConfirm={handleDeleteSyllabus}
            />
          )
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <ChaptersPanel
          syllabusId={syllabus.id}
          chapters={syllabus.chapters}
          canManage={canManage}
          selectedChapterId={selectedChapterId}
          onSelect={(id) => setSelectedChapterId(id || null)}
          onChanged={refetch}
        />
        <SchedulePanel chapter={selectedChapter} canManage={canManage} onChanged={refetch} />
      </div>
    </div>
  );
}
