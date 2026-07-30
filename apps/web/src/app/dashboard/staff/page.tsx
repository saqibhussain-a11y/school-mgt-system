"use client";

import { toast } from "sonner";
import { UserMinus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ResetPasswordButton } from "@/components/shared/reset-password-button";
import { CreateStaffDialog } from "@/components/staff/create-staff-dialog";
import { EditStaffDialog } from "@/components/staff/edit-staff-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatRole } from "@/lib/format";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN"];

interface StaffSummary {
  id: string;
  designation: string;
  status: "ACTIVE" | "DEACTIVATED";
  user: { id: string; firstName: string; lastName: string; email: string; role: string };
}

export default function StaffPage() {
  const { user } = useAuth();
  const canManage = !!user && ADMIN_ROLES.includes(user.role);
  const { data: staff, loading, refetch } = useApi<StaffSummary[]>("/api/staff");

  async function handleDeactivate(id: string) {
    try {
      await apiFetch(`/api/staff/${id}`, { method: "DELETE" });
      toast.success("Staff member deactivated");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to deactivate staff member");
    }
  }

  return (
    <div>
      <PageHeader
        title="Staff"
        description="Manage teachers and other staff"
        action={canManage && <CreateStaffDialog onCreated={refetch} />}
      />

      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !staff || staff.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No staff members yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    {member.user.firstName} {member.user.lastName}
                  </TableCell>
                  <TableCell>{member.user.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{formatRole(member.user.role)}</Badge>
                  </TableCell>
                  <TableCell>{member.designation}</TableCell>
                  <TableCell>
                    <StatusBadge status={member.status} />
                  </TableCell>
                  {canManage && (
                    <TableCell className="flex justify-end gap-1">
                      <EditStaffDialog
                        staffId={member.id}
                        currentDesignation={member.designation}
                        onSaved={refetch}
                      />
                      <ResetPasswordButton userId={member.user.id} />
                      <ConfirmDialog
                        trigger={
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={member.status === "DEACTIVATED"}
                          >
                            <UserMinus className="size-4" />
                          </Button>
                        }
                        title="Deactivate this staff member?"
                        description="Their account and historical records are kept — this only changes their status to Deactivated."
                        confirmLabel="Deactivate"
                        destructive
                        onConfirm={() => handleDeactivate(member.id)}
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
