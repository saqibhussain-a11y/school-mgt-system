"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { apiFetch, ApiError } from "@/lib/api-client";
import type { SchoolClass } from "@/components/academics/classes-tab";
import type { StudentSummary } from "@/components/students/types";

interface Section {
  id: string;
  name: string;
}

interface AttendanceRecord {
  studentId: string;
  status: string;
  remarks: string | null;
}

const STATUSES = ["PRESENT", "ABSENT", "HALF_DAY", "LEAVE"];
const STATUS_ITEMS = STATUSES.map((s) => ({ value: s, label: s.replace("_", " ") }));

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function MarkAttendanceTab() {
  const { data: classes } = useApi<SchoolClass[]>("/api/classes");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [date, setDate] = useState(todayInputValue());

  useEffect(() => {
    if (!classId && classes && classes.length > 0) setClassId(classes[0].id);
  }, [classes, classId]);

  const { data: sections } = useApi<Section[]>(classId ? `/api/sections?classId=${classId}` : null);
  useEffect(() => {
    setSectionId("");
  }, [classId]);
  useEffect(() => {
    if (!sectionId && sections && sections.length > 0) setSectionId(sections[0].id);
  }, [sections, sectionId]);

  const { data: roster, loading: rosterLoading } = useApi<StudentSummary[]>(
    classId && sectionId ? `/api/students?classId=${classId}&sectionId=${sectionId}` : null,
  );
  const { data: existing, loading: existingLoading, refetch: refetchExisting } = useApi<
    AttendanceRecord[]
  >(classId && sectionId && date ? `/api/attendance?classId=${classId}&sectionId=${sectionId}&date=${date}` : null);

  const [drafts, setDrafts] = useState<Record<string, { status: string; remarks: string }>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!roster) return;
    const next: Record<string, { status: string; remarks: string }> = {};
    for (const student of roster) {
      if (student.status !== "ACTIVE") continue;
      const found = existing?.find((r) => r.studentId === student.id);
      next[student.id] = { status: found?.status ?? "PRESENT", remarks: found?.remarks ?? "" };
    }
    setDrafts(next);
  }, [roster, existing]);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const records = Object.entries(drafts).map(([studentId, d]) => ({
        studentId,
        status: d.status,
        remarks: d.remarks || undefined,
      }));
      await apiFetch("/api/attendance", {
        method: "POST",
        body: JSON.stringify({ classId, sectionId, date, records }),
      });
      toast.success("Attendance saved");
      refetchExisting();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save attendance");
    } finally {
      setSubmitting(false);
    }
  }

  const activeRoster = (roster ?? []).filter((s) => s.status === "ACTIVE");
  const loading = rosterLoading || existingLoading;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Label className="mb-2 block text-xs text-muted-foreground">Class</Label>
          <Select
            items={(classes ?? []).map((c) => ({ value: c.id, label: c.name }))}
            value={classId}
            onValueChange={(v) => setClassId(v ?? "")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select class" />
            </SelectTrigger>
            <SelectContent>
              {(classes ?? []).map((c) => (
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
            items={(sections ?? []).map((s) => ({ value: s.id, label: s.name }))}
            value={sectionId}
            onValueChange={(v) => setSectionId(v ?? "")}
            disabled={!classId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select section" />
            </SelectTrigger>
            <SelectContent>
              {(sections ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <Label className="mb-2 block text-xs text-muted-foreground">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !classId || !sectionId ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Select a class and section to mark attendance.
          </CardContent>
        </Card>
      ) : activeRoster.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No active students in this section.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Admission no.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-40">Status</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeRoster.map((student) => {
                  const draft = drafts[student.id] ?? { status: "PRESENT", remarks: "" };
                  return (
                    <TableRow key={student.id}>
                      <TableCell>{student.admissionNo}</TableCell>
                      <TableCell className="font-medium">
                        {student.user.firstName} {student.user.lastName}
                      </TableCell>
                      <TableCell>
                        <Select
                          items={STATUS_ITEMS}
                          value={draft.status}
                          onValueChange={(v) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [student.id]: { ...draft, status: v ?? draft.status },
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s.replace("_", " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={draft.remarks}
                          placeholder="Optional"
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [student.id]: { ...draft, remarks: e.target.value },
                            }))
                          }
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Saving…" : "Save attendance"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
