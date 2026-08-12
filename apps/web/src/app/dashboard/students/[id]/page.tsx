"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, UserX } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ResetPasswordButton } from "@/components/shared/reset-password-button";
import { EditStudentDialog } from "@/components/students/edit-student-dialog";
import { LinkGuardianDialog } from "@/components/students/link-guardian-dialog";
import { AttendanceHistoryView } from "@/components/attendance/attendance-history-view";
import { GenerateCertificateDialog } from "@/components/documents/generate-certificate-dialog";
import { IssuedDocumentsList } from "@/components/documents/issued-documents-list";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { StudentDetail } from "@/components/students/types";

const ADMIN_ROLES = ["SCHOOL_ADMIN"];
// Broader than ADMIN_ROLES above (which only gates edit/withdraw) — matches
// the backend's document-issuance permission (SUPER_ADMIN/SCHOOL_ADMIN/PRINCIPAL).
const DOCUMENT_ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"];

export default function StudentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const canManage = !!user && ADMIN_ROLES.includes(user.role);

  const { data: student, loading, refetch } = useApi<StudentDetail>(
    `/api/students/${params.id}`,
  );
  const canManageDocuments = !!user && DOCUMENT_ADMIN_ROLES.includes(user.role);
  const [documentsVersion, setDocumentsVersion] = useState(0);

  async function handleWithdraw() {
    try {
      await apiFetch(`/api/students/${params.id}`, { method: "DELETE" });
      toast.success("Student withdrawn");
      router.push("/dashboard/students");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to withdraw student");
    }
  }

  async function handleUnlink(guardianId: string) {
    try {
      await apiFetch(`/api/students/${params.id}/guardians/${guardianId}`, { method: "DELETE" });
      toast.success("Guardian unlinked");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to unlink guardian");
    }
  }

  // Attendance/Documents below only ever need the route's studentId, which
  // is already known from params.id before the /api/students/:id fetch even
  // starts — they used to wait on `student` to resolve anyway (nested inside
  // the same loading gate as the profile/guardian cards, which genuinely do
  // need the full student record), turning one independent fetch into a
  // needless second leg of a waterfall. They're rendered unconditionally
  // below instead, using params.id directly, with their own already-existing
  // internal loading states.
  const studentId = params.id;

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className="mb-2"
        onClick={() => router.push("/dashboard/students")}
      >
        <ArrowLeft className="size-4" />
        Back to students
      </Button>

      {loading || !student ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : (
        <>
          <PageHeader
            title={`${student.user.firstName} ${student.user.lastName}`}
            description={`Admission no. ${student.admissionNo}`}
            action={
              canManage && (
                <div className="flex gap-2">
                  <EditStudentDialog student={student} onSaved={refetch} />
                  <ResetPasswordButton userId={student.user.id} />
                  <ConfirmDialog
                    trigger={
                      <Button size="sm" variant="destructive" disabled={student.status === "WITHDRAWN"}>
                        <UserX className="size-4" />
                        Withdraw
                      </Button>
                    }
                    title="Withdraw this student?"
                    description="The student's account and historical records are kept — this only changes their status to Withdrawn."
                    confirmLabel="Withdraw"
                    destructive
                    onConfirm={handleWithdraw}
                  />
                </div>
              )
            }
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Profile</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <Field label="Email" value={student.user.email} />
                <Field label="Status" value={<StatusBadge status={student.status} />} />
                <Field label="Class" value={student.class.name} />
                <Field label="Section" value={student.section.name} />
                <Field label="Date of birth" value={formatDate(student.dob)} />
                <Field label="Admission date" value={formatDate(student.admissionDate)} />
                <Field label="Previous school" value={student.previousSchool ?? "—"} />
                <Field label="Medical info" value={student.medicalInfo ?? "—"} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Guardians</CardTitle>
                {canManage && <LinkGuardianDialog studentId={student.id} onLinked={refetch} />}
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {student.guardians.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No guardians linked yet.</p>
                ) : (
                  student.guardians.map((link) => (
                    <div
                      key={link.id}
                      className="flex items-start justify-between gap-2 rounded-lg border border-border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {link.guardian.user.firstName} {link.guardian.user.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{link.guardian.user.email}</p>
                        <div className="mt-1 flex gap-1">
                          <Badge variant="secondary">{link.relationshipType.replace("_", " ")}</Badge>
                          {link.isPrimaryContact && <Badge variant="secondary">Primary</Badge>}
                        </div>
                      </div>
                      {canManage && (
                        <ConfirmDialog
                          trigger={
                            <Button size="sm" variant="ghost">
                              Unlink
                            </Button>
                          }
                          title="Unlink this guardian?"
                          description="They will no longer be able to view this student's records."
                          confirmLabel="Unlink"
                          destructive
                          onConfirm={() => handleUnlink(link.guardian.id)}
                        />
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Attendance</CardTitle>
        </CardHeader>
        <CardContent>
          <AttendanceHistoryView studentId={studentId} />
        </CardContent>
      </Card>

      {canManageDocuments && (
        <Card className="mt-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Documents</CardTitle>
            <GenerateCertificateDialog
              studentId={studentId}
              onGenerated={() => setDocumentsVersion((v) => v + 1)}
              trigger={<Button size="sm">Generate certificate</Button>}
            />
          </CardHeader>
          <CardContent className="p-0">
            <IssuedDocumentsList key={documentsVersion} studentId={studentId} canManage />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="font-medium">{value}</div>
    </div>
  );
}
