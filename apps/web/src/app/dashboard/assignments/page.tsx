"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { CreateAssignmentDialog } from "@/components/assignments/create-assignment-dialog";
import { MyAssignmentsView } from "@/components/assignments/my-assignments-view";
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
import { formatDate } from "@/lib/format";
import type { AssignmentSummary } from "@/components/assignments/types";

const STAFF_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"];

function StaffAssignmentsList() {
  const router = useRouter();
  const { data: assignments, loading, refetch } = useApi<AssignmentSummary[]>("/api/assignments");

  return (
    <div>
      <PageHeader
        title="Assignments"
        description="Homework, submissions, and grading"
        action={
          <CreateAssignmentDialog
            onSaved={refetch}
            trigger={
              <Button size="sm">
                <Plus className="size-4" />
                New assignment
              </Button>
            }
          />
        }
      />
      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !assignments || assignments.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No assignments yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead>Max marks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((a) => (
                <TableRow
                  key={a.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/dashboard/assignments/${a.id}`)}
                >
                  <TableCell className="font-medium">{a.title}</TableCell>
                  <TableCell>{a.class.name}</TableCell>
                  <TableCell>{a.subject.name}</TableCell>
                  <TableCell>{formatDate(a.dueDate)}</TableCell>
                  <TableCell>{a.maxMarks}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

export default function AssignmentsPage() {
  const { user } = useAuth();
  if (!user) return null;

  if (STAFF_ROLES.includes(user.role)) {
    return <StaffAssignmentsList />;
  }

  return (
    <div>
      <PageHeader title="Assignments" description="Homework and submissions" />
      <MyAssignmentsView />
    </div>
  );
}
