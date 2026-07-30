"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { EditExamDialog } from "@/components/exams/edit-exam-dialog";
import { MarksEntryTab } from "@/components/exams/marks-entry-tab";
import { ExamOverviewTab } from "@/components/exams/exam-overview-tab";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { ExamSummary } from "@/components/exams/types";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"];

interface Assignment {
  classId: string;
}

export default function ExamDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const { data: exam, loading, refetch } = useApi<ExamSummary>(`/api/exams/${params.id}`);
  const isAdmin = !!user && ADMIN_ROLES.includes(user.role);
  const isTeacher = user?.role === "TEACHER";
  const { data: myAssignments } = useApi<Assignment[]>(isTeacher ? "/api/me/assignments" : null);
  const canManage =
    isAdmin || (isTeacher && !!exam && (myAssignments ?? []).some((a) => a.classId === exam.classId));

  async function handleDelete() {
    try {
      await apiFetch(`/api/exams/${params.id}`, { method: "DELETE" });
      toast.success("Exam deleted");
      router.push("/dashboard/exams");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete exam");
    }
  }

  if (loading || !exam) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/exams")}>
          <ArrowLeft className="size-4" />
          Back to exams
        </Button>
        <Skeleton className="mt-4 h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className="mb-2"
        onClick={() => router.push("/dashboard/exams")}
      >
        <ArrowLeft className="size-4" />
        Back to exams
      </Button>
      <PageHeader
        title={exam.name}
        description={`${exam.class.name} · ${exam.academicSession.name} · ${formatDate(exam.startDate)} – ${formatDate(exam.endDate)}`}
        action={
          isAdmin && (
            <div className="flex gap-2">
              <EditExamDialog
                exam={exam}
                onSaved={refetch}
                trigger={
                  <Button size="sm" variant="outline">
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                }
              />
              <ConfirmDialog
                trigger={
                  <Button size="sm" variant="destructive">
                    <Trash2 className="size-4" />
                    Delete
                  </Button>
                }
                title="Delete this exam?"
                description="This can't be undone. Exams with marks already entered can't be deleted."
                confirmLabel="Delete"
                destructive
                onConfirm={handleDelete}
              />
            </div>
          )
        }
      />

      {canManage ? (
        <Tabs defaultValue="marks">
          <TabsList>
            <TabsTrigger value="marks">Marks entry</TabsTrigger>
            <TabsTrigger value="overview">Overview</TabsTrigger>
          </TabsList>
          <TabsContent value="marks" className="mt-4">
            <MarksEntryTab exam={exam} />
          </TabsContent>
          <TabsContent value="overview" className="mt-4">
            <ExamOverviewTab examId={exam.id} />
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-2 py-6">
            <p className="text-sm font-medium">Subjects</p>
            <div className="flex flex-wrap gap-2">
              {exam.examSubjects.map((es) => (
                <span key={es.id} className="text-sm text-muted-foreground">
                  {es.subject.name} (max {es.maxMarks})
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
