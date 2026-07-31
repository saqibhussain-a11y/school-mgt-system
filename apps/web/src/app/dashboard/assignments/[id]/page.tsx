"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { EditAssignmentDialog } from "@/components/assignments/edit-assignment-dialog";
import { AttachmentSection } from "@/components/assignments/attachment-section";
import { SubmissionsTab } from "@/components/assignments/submissions-tab";
import { SubmissionStatusView, SubmissionStatusDisplay } from "@/components/assignments/submission-status-view";
import { SubmitAssignmentForm } from "@/components/assignments/submit-assignment-form";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { AssignmentSummary, SubmissionDetail } from "@/components/assignments/types";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"];

interface Assignment {
  classId: string;
}

interface DashboardResponse {
  role: string;
  widgets: {
    studentId?: string | null;
    children?: { studentId: string; classId: string; name: string }[];
  };
}

export default function AssignmentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const { data: assignment, loading, refetch } = useApi<AssignmentSummary>(
    `/api/assignments/${params.id}`,
  );
  const isAdmin = !!user && ADMIN_ROLES.includes(user.role);
  const isTeacher = user?.role === "TEACHER";
  const { data: myAssignments } = useApi<Assignment[]>(isTeacher ? "/api/me/assignments" : null);
  const canManage =
    isAdmin ||
    (isTeacher && !!assignment && (myAssignments ?? []).some((a) => a.classId === assignment.classId));

  const isStudent = user?.role === "STUDENT";
  const isParent = user?.role === "PARENT";
  const { data: dashboard } = useApi<DashboardResponse>(isStudent || isParent ? "/api/dashboard" : null);

  async function handleDelete() {
    try {
      await apiFetch(`/api/assignments/${params.id}`, { method: "DELETE" });
      toast.success("Assignment deleted");
      router.push("/dashboard/assignments");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete assignment");
    }
  }

  if (loading || !assignment) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/assignments")}>
          <ArrowLeft className="size-4" />
          Back to assignments
        </Button>
        <Skeleton className="mt-4 h-64 rounded-xl" />
      </div>
    );
  }

  const myChild = dashboard?.widgets.children?.find((c) => c.classId === assignment.classId);
  const myStudentId = isStudent ? dashboard?.widgets.studentId : myChild?.studentId;

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className="mb-2"
        onClick={() => router.push("/dashboard/assignments")}
      >
        <ArrowLeft className="size-4" />
        Back to assignments
      </Button>
      <PageHeader
        title={assignment.title}
        description={`${assignment.class.name} · ${assignment.subject.name} · Due ${formatDate(assignment.dueDate)} · Max marks ${assignment.maxMarks}`}
        action={
          isAdmin && (
            <div className="flex gap-2">
              <EditAssignmentDialog
                assignment={assignment}
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
                title="Delete this assignment?"
                description="This deletes all submissions too. This can't be undone."
                confirmLabel="Delete"
                destructive
                onConfirm={handleDelete}
              />
            </div>
          )
        }
      />

      <div className="flex flex-col gap-4">
        {assignment.description && (
          <Card>
            <CardContent className="py-4 text-sm whitespace-pre-wrap">{assignment.description}</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attachment</CardTitle>
          </CardHeader>
          <CardContent>
            <AttachmentSection
              assignmentId={assignment.id}
              attachmentFilename={assignment.attachmentFilename}
              canManage={canManage}
              onUploaded={refetch}
            />
          </CardContent>
        </Card>

        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Submissions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <SubmissionsTab assignmentId={assignment.id} maxMarks={assignment.maxMarks} />
            </CardContent>
          </Card>
        )}

        {isStudent && myStudentId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your submission</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <SubmissionRefresher assignmentId={assignment.id} studentId={myStudentId} maxMarks={assignment.maxMarks} />
            </CardContent>
          </Card>
        )}

        {isParent && myStudentId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{myChild?.name}&apos;s submission</CardTitle>
            </CardHeader>
            <CardContent>
              <SubmissionStatusView
                assignmentId={assignment.id}
                studentId={myStudentId}
                maxMarks={assignment.maxMarks}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function SubmissionRefresher({
  assignmentId,
  studentId,
  maxMarks,
}: {
  assignmentId: string;
  studentId: string;
  maxMarks: number;
}) {
  const { data: submission, loading, refetch } = useApi<SubmissionDetail | null>(
    `/api/assignments/${assignmentId}/submissions/${studentId}`,
  );

  return (
    <>
      {loading ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : (
        <SubmissionStatusDisplay
          submission={submission ?? null}
          assignmentId={assignmentId}
          studentId={studentId}
          maxMarks={maxMarks}
        />
      )}
      <SubmitAssignmentForm
        assignmentId={assignmentId}
        hasExistingSubmission={Boolean(submission)}
        onSubmitted={refetch}
      />
    </>
  );
}
