"use client";

import { PageHeader } from "@/components/layout/page-header";
import { IssuedDocumentsList } from "@/components/documents/issued-documents-list";
import { MyDocumentsView } from "@/components/documents/my-documents-view";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"];

export default function DocumentsPage() {
  const { user } = useAuth();
  if (!user) return null;

  if (ADMIN_ROLES.includes(user.role)) {
    return (
      <div>
        <PageHeader
          title="Documents"
          description="Certificates issued to students — generate new ones from a student's profile"
        />
        <Card>
          <IssuedDocumentsList showStudentColumn canManage />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Documents" description="Certificates issued to you" />
      <MyDocumentsView />
    </div>
  );
}
