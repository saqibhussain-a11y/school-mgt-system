"use client";

import { Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { DOCUMENT_TYPE_LABELS, type IssuedDocument } from "./types";

export function IssuedDocumentsList({
  studentId,
  showStudentColumn,
  canManage,
}: {
  studentId?: string;
  showStudentColumn?: boolean;
  canManage?: boolean;
}) {
  const path = studentId ? `/api/documents/student/${studentId}` : "/api/documents";
  const { data: documents, loading, refetch } = useApi<IssuedDocument[]>(path);

  async function handleDownload(id: string) {
    try {
      const { url } = await apiFetch<{ url: string }>(`/api/documents/${id}/download-url`);
      window.open(url, "_blank");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to download document");
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/api/documents/${id}`, { method: "DELETE" });
      toast.success("Document deleted");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete document");
    }
  }

  if (loading) return null;
  if (!documents || documents.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No documents issued yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showStudentColumn && <TableHead>Student</TableHead>}
          <TableHead>Type</TableHead>
          <TableHead>Issued by</TableHead>
          <TableHead>Issued on</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((doc) => (
          <TableRow key={doc.id}>
            {showStudentColumn && (
              <TableCell>
                {doc.student.user.firstName} {doc.student.user.lastName}
                <div className="text-xs text-muted-foreground">{doc.student.admissionNo}</div>
              </TableCell>
            )}
            <TableCell className="font-medium">{DOCUMENT_TYPE_LABELS[doc.type]}</TableCell>
            <TableCell>
              {doc.issuedBy.firstName} {doc.issuedBy.lastName}
            </TableCell>
            <TableCell>{formatDate(doc.issuedAt)}</TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" title="Download" onClick={() => handleDownload(doc.id)}>
                  <Download className="size-3.5" />
                </Button>
                {canManage && (
                  <ConfirmDialog
                    trigger={
                      <Button size="sm" variant="ghost" title="Delete">
                        <Trash2 className="size-3.5" />
                      </Button>
                    }
                    title="Delete this document record?"
                    description="This removes the stored file and the issuance record. This can't be undone."
                    confirmLabel="Delete"
                    destructive
                    onConfirm={() => handleDelete(doc.id)}
                  />
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
