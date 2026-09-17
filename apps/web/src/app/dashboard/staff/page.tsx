"use client";

import { toast } from "sonner";
import { Search as SearchIcon, UserMinus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ResetPasswordButton } from "@/components/shared/reset-password-button";
import { ManageTeacherAssignmentsDialog } from "@/components/staff/manage-teacher-assignments-dialog";
import { CreateStaffDialog } from "@/components/staff/create-staff-dialog";
import { EditStaffDialog } from "@/components/staff/edit-staff-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { TablePagination } from "@/components/shared/table-pagination";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatRole } from "@/lib/format";
import { useState } from "react";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useServerPagination } from "@/lib/use-server-pagination";

const ADMIN_ROLES = ["SCHOOL_ADMIN"];
const STAFF_COLUMN_COUNT_MANAGE = 6;
const STAFF_COLUMN_COUNT = 5;

interface StaffSummary {
  id: string;
  designation: string;
  status: "ACTIVE" | "DEACTIVATED";
  user: { id: string; firstName: string; lastName: string; email: string; role: string };
}

export default function StaffPage() {
  const { user } = useAuth();
  const canManage = !!user && ADMIN_ROLES.includes(user.role);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const { page, setPage, pageSize, setPageSize } = useServerPagination(debouncedSearch.trim());

  const query = new URLSearchParams();
  if (debouncedSearch.trim()) query.set("search", debouncedSearch.trim());
  query.set("page", String(page));
  query.set("pageSize", String(pageSize));

  const {
    data: result,
    loading,
    refetch,
  } = useApi<{ data: StaffSummary[]; total: number }>(`/api/staff?${query.toString()}`);
  const staff = result?.data;
  const total = result?.total ?? 0;

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

      <div className="mb-4 relative w-64">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or designation"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {!loading && (!staff || staff.length === 0) ? (
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
            {loading || !staff ? (
              <TableSkeleton columns={canManage ? STAFF_COLUMN_COUNT_MANAGE : STAFF_COLUMN_COUNT} />
            ) : (
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
                      {member.user.role === "TEACHER" && (
                        <ManageTeacherAssignmentsDialog staffId={member.id} />
                      )}
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
            )}
          </Table>
          {!loading && (
            <TablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
          )}
        </Card>
      )}
    </div>
  );
}
