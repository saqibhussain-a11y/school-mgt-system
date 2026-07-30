"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { attendanceTone } from "@/lib/attendance-tone";
import { toDateInputValue } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SchoolClass } from "@/components/academics/classes-tab";

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

interface StudentRangeSummary {
  studentId: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  breakdown: Record<string, number>;
  percentage: number;
}

const PRESETS = [
  { key: "week", label: "Last 7 days" },
  { key: "month", label: "Last 30 days" },
  { key: "all", label: "All time" },
] as const;

type PresetKey = (typeof PRESETS)[number]["key"];

const TONE_TEXT: Record<ReturnType<typeof attendanceTone>, string> = {
  good: "text-status-good",
  warning: "text-status-warning",
  critical: "text-status-critical",
};

function rangeFor(preset: PresetKey) {
  if (preset === "all") return {};
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (preset === "week" ? 6 : 29));
  return { from: toDateInputValue(from), to: toDateInputValue(to) };
}

export function ClassSummaryTab() {
  const { user } = useAuth();
  const router = useRouter();
  const isTeacher = user?.role === "TEACHER";

  const { data: allClasses } = useApi<SchoolClass[]>(!isTeacher ? "/api/classes" : null);
  const { data: myAssignments } = useApi<Assignment[]>(isTeacher ? "/api/me/assignments" : null);

  const classes = isTeacher
    ? Array.from(new Map((myAssignments ?? []).map((a) => [a.classId, a.class])).values())
    : allClasses ?? [];

  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [preset, setPreset] = useState<PresetKey>("month");

  useEffect(() => {
    if (!classId && classes.length > 0) setClassId(classes[0].id);
  }, [classes, classId]);

  const { data: fetchedSections } = useApi<Section[]>(
    !isTeacher && classId ? `/api/sections?classId=${classId}` : null,
  );
  const sections = isTeacher
    ? (myAssignments ?? []).filter((a) => a.classId === classId).map((a) => a.section)
    : fetchedSections ?? [];

  useEffect(() => {
    setSectionId("");
  }, [classId]);
  useEffect(() => {
    if (!sectionId && sections.length > 0) setSectionId(sections[0].id);
  }, [sections, sectionId]);

  const range = rangeFor(preset);
  const rangeQs = range.from ? `&from=${range.from}&to=${range.to}` : "";
  const { data: summary, loading } = useApi<StudentRangeSummary[]>(
    classId && sectionId
      ? `/api/attendance/summary?classId=${classId}&sectionId=${sectionId}${rangeQs}`
      : null,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Label className="mb-2 block text-xs text-muted-foreground">Class</Label>
          <Select
            items={classes.map((c) => ({ value: c.id, label: c.name }))}
            value={classId}
            onValueChange={(v) => setClassId(v ?? "")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select class" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <Label className="mb-2 block text-xs text-muted-foreground">Section</Label>
          <Select
            items={sections.map((s) => ({ value: s.id, label: s.name }))}
            value={sectionId}
            onValueChange={(v) => setSectionId(v ?? "")}
            disabled={!classId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select section" />
            </SelectTrigger>
            <SelectContent>
              {sections.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-1">
          {PRESETS.map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant={preset === p.key ? "default" : "outline"}
              onClick={() => setPreset(p.key)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {!classId || !sectionId ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Select a class and section to view attendance for that period.
          </CardContent>
        </Card>
      ) : loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !summary || summary.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No active students in this section.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Admission no.</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Present</TableHead>
                <TableHead>Absent</TableHead>
                <TableHead>Half day</TableHead>
                <TableHead>Leave</TableHead>
                <TableHead>Attendance %</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.map((s) => (
                <TableRow key={s.studentId}>
                  <TableCell>{s.admissionNo}</TableCell>
                  <TableCell className="font-medium">
                    {s.firstName} {s.lastName}
                  </TableCell>
                  <TableCell>{s.breakdown.PRESENT ?? 0}</TableCell>
                  <TableCell>{s.breakdown.ABSENT ?? 0}</TableCell>
                  <TableCell>{s.breakdown.HALF_DAY ?? 0}</TableCell>
                  <TableCell>{s.breakdown.LEAVE ?? 0}</TableCell>
                  <TableCell className={cn("font-medium", TONE_TEXT[attendanceTone(s.percentage)])}>
                    {s.percentage}%
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      title="View details"
                      onClick={() => router.push(`/dashboard/students/${s.studentId}`)}
                    >
                      <Eye className="size-3.5" />
                    </Button>
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
