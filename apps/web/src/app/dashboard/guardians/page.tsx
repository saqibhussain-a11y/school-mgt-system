"use client";

import { PageHeader } from "@/components/layout/page-header";
import { CreateGuardianDialog } from "@/components/guardians/create-guardian-dialog";
import { EditGuardianDialog } from "@/components/guardians/edit-guardian-dialog";
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
import { useAuth } from "@/lib/auth-context";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN"];

interface GuardianSummary {
  id: string;
  phone: string | null;
  address: string | null;
  user: { firstName: string; lastName: string; email: string };
}

export default function GuardiansPage() {
  const { user } = useAuth();
  const canManage = !!user && ADMIN_ROLES.includes(user.role);
  const { data: guardians, loading, refetch } = useApi<GuardianSummary[]>("/api/guardians");

  return (
    <div>
      <PageHeader
        title="Guardians"
        description="Manage parent and guardian accounts"
        action={canManage && <CreateGuardianDialog onCreated={refetch} />}
      />

      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !guardians || guardians.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No guardians yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Address</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {guardians.map((guardian) => (
                <TableRow key={guardian.id}>
                  <TableCell className="font-medium">
                    {guardian.user.firstName} {guardian.user.lastName}
                  </TableCell>
                  <TableCell>{guardian.user.email}</TableCell>
                  <TableCell>{guardian.phone ?? "—"}</TableCell>
                  <TableCell>{guardian.address ?? "—"}</TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <EditGuardianDialog
                        guardianId={guardian.id}
                        currentPhone={guardian.phone ?? ""}
                        currentAddress={guardian.address ?? ""}
                        onSaved={refetch}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
