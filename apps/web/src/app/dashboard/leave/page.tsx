"use client";

import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ApplyLeaveDialog } from "@/components/leave/apply-leave-dialog";
import { LeaveRequestTable, type LeaveRequestSummary } from "@/components/leave/leave-request-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth-context";
import type { UserRole } from "@sms/shared-types";

const APPLICANT_ROLES: UserRole[] = [
  "PRINCIPAL",
  "TEACHER",
  "ACCOUNTANT",
  "LIBRARIAN",
  "TRANSPORT_MANAGER",
  "STUDENT",
];
const REVIEW_ROLES: UserRole[] = ["SCHOOL_ADMIN", "PRINCIPAL"];
const VIEW_ALL_ROLES: UserRole[] = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"];

interface LeaveBalance {
  leaveType: string;
  totalDays: number;
  usedDays: number;
  remainingDays: number;
}

export default function LeavePage() {
  const { user } = useAuth();
  const canApply = !!user && APPLICANT_ROLES.includes(user.role);
  const canReview = !!user && REVIEW_ROLES.includes(user.role);
  const canViewAll = !!user && VIEW_ALL_ROLES.includes(user.role);

  const myRequests = useApi<LeaveRequestSummary[]>("/api/leave-requests/me");
  const allRequests = useApi<LeaveRequestSummary[]>(canViewAll ? "/api/leave-requests" : null);
  const { data: balance } = useApi<LeaveBalance[] | null>("/api/leave-requests/balance");

  function refetchAll() {
    myRequests.refetch();
    allRequests.refetch();
  }

  const myTab = (
    <div className="flex flex-col gap-4">
      {balance && balance.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {balance.map((b) => (
            <Card key={b.leaveType}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium capitalize text-muted-foreground">
                  {b.leaveType} leave
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{b.remainingDays}</div>
                <div className="text-xs text-muted-foreground">
                  of {b.totalDays} days left this year ({b.usedDays} used)
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {myRequests.loading ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : myRequests.error ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {myRequests.error}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <LeaveRequestTable
              requests={myRequests.data ?? []}
              canCancel
              onChanged={refetchAll}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );

  const allTab = (
    <Card>
      <CardContent className="p-0">
        {allRequests.loading ? (
          <div className="p-6">
            <Skeleton className="h-48 rounded-xl" />
          </div>
        ) : allRequests.error ? (
          <div className="py-10 text-center text-sm text-muted-foreground">{allRequests.error}</div>
        ) : (
          <LeaveRequestTable
            requests={allRequests.data ?? []}
            showApplicant
            canReview={canReview}
            onChanged={refetchAll}
          />
        )}
      </CardContent>
    </Card>
  );

  return (
    <div>
      <PageHeader
        title="Leave"
        description="Apply for leave and track approvals"
        action={
          canApply && (
            <ApplyLeaveDialog
              onSaved={refetchAll}
              trigger={
                <Button size="sm">
                  <Plus className="size-4" />
                  Apply for leave
                </Button>
              }
            />
          )
        }
      />

      {canApply && canViewAll ? (
        <Tabs defaultValue="mine">
          <TabsList>
            <TabsTrigger value="mine">My requests</TabsTrigger>
            <TabsTrigger value="all">All requests</TabsTrigger>
          </TabsList>
          <TabsContent value="mine">{myTab}</TabsContent>
          <TabsContent value="all">{allTab}</TabsContent>
        </Tabs>
      ) : canViewAll ? (
        allTab
      ) : (
        myTab
      )}
    </div>
  );
}
