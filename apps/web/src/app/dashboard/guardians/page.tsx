"use client";

import { useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { CreateGuardianDialog } from "@/components/guardians/create-guardian-dialog";
import { EditGuardianDialog } from "@/components/guardians/edit-guardian-dialog";
import { ResetPasswordButton } from "@/components/shared/reset-password-button";
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
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useServerPagination } from "@/lib/use-server-pagination";

const ADMIN_ROLES = ["SCHOOL_ADMIN"];
const GUARDIAN_COLUMN_COUNT_MANAGE = 5;
const GUARDIAN_COLUMN_COUNT = 4;

interface GuardianSummary {
  id: string;
  phone: string | null;
  address: string | null;
  user: { id: string; firstName: string; lastName: string; email: string };
}

export default function GuardiansPage() {
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
  } = useApi<{ data: GuardianSummary[]; total: number }>(`/api/guardians?${query.toString()}`);
  const guardians = result?.data;
  const total = result?.total ?? 0;

  return (
    <div>
      <PageHeader
        title="Guardians"
        description="Manage parent and guardian accounts"
        action={canManage && <CreateGuardianDialog onCreated={refetch} />}
      />

      <div className="mb-4 relative w-64">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {!loading && (!guardians || guardians.length === 0) ? (
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
            {loading || !guardians ? (
              <TableSkeleton columns={canManage ? GUARDIAN_COLUMN_COUNT_MANAGE : GUARDIAN_COLUMN_COUNT} />
            ) : (
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
                      <TableCell className="flex justify-end gap-1">
                        <EditGuardianDialog
                          guardianId={guardian.id}
                          currentPhone={guardian.phone ?? ""}
                          currentAddress={guardian.address ?? ""}
                          onSaved={refetch}
                        />
                        <ResetPasswordButton userId={guardian.user.id} />
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
