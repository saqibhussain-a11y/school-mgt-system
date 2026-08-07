"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { CreateExamDialog } from "@/components/exams/create-exam-dialog";
import { MyExamsView } from "@/components/exams/my-exams-view";
import { ExamSessionsTab } from "@/components/exam-sessions/exam-sessions-tab";
import { MyInvigilationDutiesView } from "@/components/exams/my-invigilation-duties-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import type { ExamSummary } from "@/components/exams/types";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"];
const STAFF_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"];

function ExamsListTab() {
  const { user } = useAuth();
  const router = useRouter();
  const canManage = !!user && ADMIN_ROLES.includes(user.role);
  const { data: exams, loading, refetch } = useApi<ExamSummary[]>("/api/exams");

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <div className="flex justify-end">
          <CreateExamDialog
            onSaved={refetch}
            trigger={
              <Button size="sm">
                <Plus className="size-4" />
                New exam
              </Button>
            }
          />
        </div>
      )}
      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !exams || exams.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No exams yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Subjects</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exams.map((exam) => (
                <TableRow
                  key={exam.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/dashboard/exams/${exam.id}`)}
                >
                  <TableCell className="font-medium">{exam.name}</TableCell>
                  <TableCell>{exam.class.name}</TableCell>
                  <TableCell>{exam.academicSession.name}</TableCell>
                  <TableCell>
                    {formatDate(exam.startDate)} – {formatDate(exam.endDate)}
                  </TableCell>
                  <TableCell>{exam.examSubjects.length}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function StaffExamsPage() {
  const { user } = useAuth();
  const canManage = !!user && ADMIN_ROLES.includes(user.role);

  return (
    <div>
      <PageHeader title="Exams" description="Exam schedules, marks entry, seating, and admit cards" />
      <Tabs defaultValue="exams">
        <TabsList>
          <TabsTrigger value="exams">Exams</TabsTrigger>
          <TabsTrigger value="sessions">Exam Sessions</TabsTrigger>
          <TabsTrigger value="duties">My Duties</TabsTrigger>
        </TabsList>
        <TabsContent value="exams" className="mt-4">
          <ExamsListTab />
        </TabsContent>
        <TabsContent value="sessions" className="mt-4">
          <ExamSessionsTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="duties" className="mt-4">
          <MyInvigilationDutiesView />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ExamsPage() {
  const { user } = useAuth();
  if (!user) return null;

  if (STAFF_ROLES.includes(user.role)) {
    return <StaffExamsPage />;
  }

  return (
    <div>
      <PageHeader title="Exams" description="Exam schedules and report cards" />
      <MyExamsView />
    </div>
  );
}
