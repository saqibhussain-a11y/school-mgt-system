"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateSyllabusDialog } from "@/components/curriculum/create-syllabus-dialog";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth-context";
import type { SyllabusSummary } from "@/components/curriculum/types";

const MANAGE_ROLES = ["SCHOOL_ADMIN", "PRINCIPAL"];

export default function CurriculumPage() {
  const { user } = useAuth();
  const router = useRouter();
  const canManage = !!user && MANAGE_ROLES.includes(user.role);

  const { data: syllabuses, loading, refetch } = useApi<SyllabusSummary[]>(
    user?.role === "TEACHER" ? "/api/me/syllabus" : "/api/syllabuses",
  );

  return (
    <div>
      <PageHeader
        title="Curriculum"
        description="What each class covers in each subject, and when — the pacing plan for the term."
        action={
          canManage && (
            <CreateSyllabusDialog
              trigger={
                <Button size="sm">
                  <Plus className="size-4" />
                  New syllabus
                </Button>
              }
              onCreated={refetch}
            />
          )
        }
      />

      {loading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : !syllabuses || syllabuses.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {user?.role === "TEACHER"
              ? "No syllabus has been set up for the subjects you teach yet."
              : "No syllabus set up yet. Create one to start planning a class's pacing."}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Session</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {syllabuses.map((s) => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/dashboard/curriculum/${s.id}`)}
                >
                  <TableCell className="font-medium">{s.class.name}</TableCell>
                  <TableCell>{s.subject.name}</TableCell>
                  <TableCell>{s.academicSession.name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
