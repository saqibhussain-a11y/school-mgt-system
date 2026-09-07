"use client";

import { Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EditPlanDialog } from "@/components/platform/edit-plan-dialog";
import type { Plan } from "@/components/platform/types";
import { usePlatformApi } from "@/lib/use-platform-api";
import { formatCurrency, formatRelativeTime } from "@/lib/format";

export default function PlatformPlansPage() {
  const { data: plans, loading, refetch } = usePlatformApi<Plan[]>("/api/platform/plans");

  return (
    <div>
      <PageHeader
        title="Plans"
        description="Pricing and seat limits for each subscription tier — edits apply to every school on that plan"
      />

      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !plans || plans.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">No plans configured.</CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Price / month</TableHead>
                <TableHead>Max students</TableHead>
                <TableHead>Max staff</TableHead>
                <TableHead>Last updated</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.key}>
                  <TableCell className="font-medium">{plan.label}</TableCell>
                  <TableCell>{formatCurrency(plan.priceMonthly)}</TableCell>
                  <TableCell>{plan.maxStudents.toLocaleString()}</TableCell>
                  <TableCell>{plan.maxStaff.toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground">{formatRelativeTime(plan.updatedAt)}</TableCell>
                  <TableCell>
                    <EditPlanDialog
                      plan={plan}
                      onSaved={refetch}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label={`Edit ${plan.label} plan`}>
                          <Pencil className="size-4" />
                        </Button>
                      }
                    />
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
