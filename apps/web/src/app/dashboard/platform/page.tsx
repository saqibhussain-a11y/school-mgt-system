"use client";

import { PageHeader } from "@/components/layout/page-header";
import { CreateSchoolDialog } from "@/components/platform/create-school-dialog";
import { SubscriptionStatusSelect } from "@/components/platform/subscription-status-select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/lib/use-api";
import { formatDate } from "@/lib/format";
import type { PlatformSchool } from "@/components/platform/types";

export default function PlatformPage() {
  const { data: schools, loading, refetch } = useApi<PlatformSchool[]>("/api/platform/schools");

  return (
    <div>
      <PageHeader
        title="Platform"
        description="Every school on this system — provisioning and subscription status"
        action={<CreateSchoolDialog onCreated={refetch} />}
      />

      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !schools || schools.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No schools yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School</TableHead>
                <TableHead>Subdomain</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schools.map((school) => (
                <TableRow key={school.id}>
                  <TableCell className="font-medium">{school.name}</TableCell>
                  <TableCell className="text-muted-foreground">{school.subdomain}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{school.subscriptionPlan}</Badge>
                  </TableCell>
                  <TableCell>
                    <SubscriptionStatusSelect
                      schoolId={school.id}
                      status={school.subscriptionStatus}
                      onChanged={refetch}
                    />
                  </TableCell>
                  <TableCell>{formatDate(school.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
