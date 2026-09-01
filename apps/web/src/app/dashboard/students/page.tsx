"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search as SearchIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { CreateStudentDialog } from "@/components/students/create-student-dialog";
import { BulkImportDialog } from "@/components/students/bulk-import-dialog";
import { AdmissionNumberFormatDialog } from "@/components/students/admission-number-format-dialog";
import type { StudentSummary } from "@/components/students/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useAuth } from "@/lib/auth-context";
import type { SchoolClass } from "@/components/academics/classes-tab";

const ADMIN_ROLES = ["SCHOOL_ADMIN"];

interface Section {
  id: string;
  name: string;
}

interface Assignment {
  classId: string;
  sectionId: string;
  class: { id: string; name: string };
  section: { id: string; name: string };
}

export default function StudentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const canManage = !!user && ADMIN_ROLES.includes(user.role);
  const isTeacher = user?.role === "TEACHER";

  const { data: allClasses } = useApi<SchoolClass[]>(!isTeacher ? "/api/classes" : null);
  const { data: myAssignments } = useApi<Assignment[]>(isTeacher ? "/api/me/assignments" : null);
  const classes = isTeacher
    ? Array.from(new Map((myAssignments ?? []).map((a) => [a.classId, a.class])).values())
    : allClasses ?? [];

  const [classId, setClassId] = useState<string>("all");
  const [sectionId, setSectionId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const { data: fetchedSections } = useApi<Section[]>(
    !isTeacher && classId !== "all" ? `/api/sections?classId=${classId}` : null,
  );
  const sections = isTeacher
    ? (myAssignments ?? []).filter((a) => a.classId === classId).map((a) => a.section)
    : fetchedSections ?? [];

  useEffect(() => {
    setSectionId("all");
  }, [classId]);

  const query = new URLSearchParams();
  if (classId !== "all") query.set("classId", classId);
  if (sectionId !== "all") query.set("sectionId", sectionId);
  if (debouncedSearch.trim()) query.set("search", debouncedSearch.trim());
  const queryString = query.toString();

  const {
    data: students,
    loading,
    refetch,
  } = useApi<StudentSummary[]>(`/api/students${queryString ? `?${queryString}` : ""}`);

  return (
    <div>
      <PageHeader
        title="Students"
        description="Manage student profiles and enrollment"
        action={
          canManage && (
            <div className="flex flex-wrap gap-2">
              <AdmissionNumberFormatDialog />
              <BulkImportDialog onImported={refetch} />
              <CreateStudentDialog onCreated={refetch} />
            </div>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative w-64">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or admission no."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="w-48">
          <Select
            items={[{ value: "all", label: "All classes" }, ...(classes ?? []).map((c) => ({ value: c.id, label: c.name }))]}
            value={classId}
            onValueChange={(v) => setClassId(v ?? "all")}
          >
            <SelectTrigger>
              <SelectValue placeholder="All classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All classes</SelectItem>
              {(classes ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <Select
            items={[{ value: "all", label: "All sections" }, ...(sections ?? []).map((s) => ({ value: s.id, label: s.name }))]}
            value={sectionId}
            onValueChange={(v) => setSectionId(v ?? "all")}
            disabled={classId === "all"}
          >
            <SelectTrigger>
              <SelectValue placeholder="All sections" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sections</SelectItem>
              {(sections ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !students || students.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No students found.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Admission no.</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow
                  key={student.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/dashboard/students/${student.id}`)}
                >
                  <TableCell className="font-medium">{student.admissionNo}</TableCell>
                  <TableCell>
                    {student.user.firstName} {student.user.lastName}
                  </TableCell>
                  <TableCell>{student.class.name}</TableCell>
                  <TableCell>{student.section.name}</TableCell>
                  <TableCell>
                    <StatusBadge status={student.status} />
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
