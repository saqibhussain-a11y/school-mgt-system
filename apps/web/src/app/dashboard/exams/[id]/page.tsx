"use client";

import { useParams, useRouter } from "next/navigation";
import { Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { EditExamDialog } from "@/components/exams/edit-exam-dialog";
import { MarksEntryTab } from "@/components/exams/marks-entry-tab";
import { ExamOverviewTab } from "@/components/exams/exam-overview-tab";
import { ClassResultSheetTab } from "@/components/exams/class-result-sheet-tab";
import { DatesheetTab } from "@/components/exams/datesheet-tab";
import { ClassSeatingTab } from "@/components/exams/class-seating-tab";
import { ClassInvigilationTab } from "@/components/exams/class-invigilation-tab";
import { AdmitCardsTab } from "@/components/exams/admit-cards-tab";
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

  async function handleTogglePublish() {
    if (!exam) return;
    try {
      if (exam.status === "PUBLISHED") {
        await apiFetch(`/api/exams/${exam.id}/unpublish`, { method: "POST" });
        toast.success("Results hidden from students/parents");
      } else {
        await apiFetch(`/api/exams/${exam.id}/publish`, { method: "POST" });
        toast.success("Results published to students/parents");
      }
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update publish status");
    }
  }

  if (loading || !exam) {
    return (
      <div>
        <Breadcrumbs items={[{ label: "Exams", href: "/dashboard/exams" }, { label: "…" }]} />
        <Skeleton className="mt-4 h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: "Exams", href: "/dashboard/exams" }, { label: exam.name }]} />
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            {exam.name}
            <Badge variant={exam.status === "PUBLISHED" ? "default" : "secondary"}>
              {exam.status === "PUBLISHED" ? "Published" : "Draft"}
            </Badge>
          </div>
        }
        description={`${exam.class.name} · ${exam.academicSession.name} · ${formatDate(exam.startDate)} – ${formatDate(exam.endDate)}`}
        action={
          isAdmin && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleTogglePublish}>
                {exam.status === "PUBLISHED" ? (
                  <>
                    <EyeOff className="size-4" />
                    Unpublish
                  </>
                ) : (
                  <>
                    <Eye className="size-4" />
                    Publish results
                  </>
                )}
              </Button>
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
            <TabsTrigger value="result-sheet">Result sheet</TabsTrigger>
            <TabsTrigger value="datesheet">Datesheet</TabsTrigger>
            <TabsTrigger value="seating">Seating</TabsTrigger>
            <TabsTrigger value="invigilation">Invigilation</TabsTrigger>
            <TabsTrigger value="admit-cards">Admit Cards</TabsTrigger>
          </TabsList>
          <TabsContent value="marks" className="mt-4">
            <MarksEntryTab exam={exam} />
          </TabsContent>
          <TabsContent value="overview" className="mt-4">
            <ExamOverviewTab examId={exam.id} />
          </TabsContent>
          <TabsContent value="result-sheet" className="mt-4">
            <ClassResultSheetTab examId={exam.id} />
          </TabsContent>
          <TabsContent value="datesheet" className="mt-4">
            <DatesheetTab exam={exam} onChanged={refetch} />
          </TabsContent>
          <TabsContent value="seating" className="mt-4">
            <ClassSeatingTab examId={exam.id} examSessionId={exam.examSessionId} onGenerated={refetch} />
          </TabsContent>
          <TabsContent value="invigilation" className="mt-4">
            <ClassInvigilationTab examSessionId={exam.examSessionId} />
          </TabsContent>
          <TabsContent value="admit-cards" className="mt-4">
            <AdmitCardsTab examId={exam.id} classId={exam.classId} />
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
