"use client";

import { PageHeader } from "@/components/layout/page-header";
import { CreateSchoolAdminDialog } from "@/components/school-admins/create-school-admin-dialog";
import { ResetPasswordButton } from "@/components/shared/reset-password-button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApi } from "@/lib/use-api";
import { formatDate } from "@/lib/format";

interface SchoolAdmin {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
}

export default function SchoolAdminsPage() {
  const {
    data: admins,
    loading,
    refetch,
  } = useApi<SchoolAdmin[]>("/api/users/school-admins");

  return (
    <div>
      <PageHeader
        title="School Admins"
        description="Accounts that manage day-to-day school operations"
        action={<CreateSchoolAdminDialog onCreated={refetch} />}
      />

      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !admins || admins.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No school admins yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell className="font-medium">
                    {admin.firstName} {admin.lastName}
                  </TableCell>
                  <TableCell>{admin.email}</TableCell>
                  <TableCell>{formatDate(admin.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <ResetPasswordButton userId={admin.id} />
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
