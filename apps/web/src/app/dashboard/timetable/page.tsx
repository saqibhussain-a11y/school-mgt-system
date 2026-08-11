"use client";

import { useEffect, useState } from "react";
import { Pencil, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SlotFormDialog } from "@/components/timetable/slot-form-dialog";
import { TimetableGrid, type TimetableSlotSummary } from "@/components/timetable/timetable-grid";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { SchoolClass } from "@/components/academics/classes-tab";
import type { Room } from "@/components/academics/room-types";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"];

interface Section {
  id: string;
  name: string;
}

interface StaffOption {
  id: string;
  user: { firstName: string; lastName: string };
}

interface GenerateResult {
  createdCount: number;
  warnings: string[];
  notices: string[];
  unscheduledPeriodCount: number;
}

function GenerateTimetableButton({
  classId,
  onGenerated,
}: {
  classId?: string;
  onGenerated: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);

  async function handleGenerate() {
    setSubmitting(true);
    setResult(null);
    try {
      const body = classId ? { classId } : {};
      const data = await apiFetch<GenerateResult>("/api/timetable/generate", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setResult(data);
      toast.success(`Generated ${data.createdCount} timetable slot${data.createdCount === 1 ? "" : "s"}`);
      onGenerated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to generate timetable");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button size="sm" onClick={handleGenerate} disabled={submitting}>
        <Sparkles className="size-4" />
        {submitting ? "Generating…" : classId ? "Generate for this class" : "Generate timetable"}
      </Button>
      {result && (result.unscheduledPeriodCount > 0 || result.notices.length > 0) && (
        <Card className="max-w-lg">
          <CardContent className="flex flex-col gap-3 py-3 text-sm">
            {result.unscheduledPeriodCount > 0 && (
              <div className="flex flex-col gap-1">
                <span className="font-medium text-status-warning">
                  {`${result.unscheduledPeriodCount} period${result.unscheduledPeriodCount === 1 ? "" : "s"} couldn't be scheduled`}
                </span>
                <ul className="list-disc pl-4 text-xs text-muted-foreground">
                  {result.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.notices.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="font-medium text-muted-foreground">Scheduled, with some compromises</span>
                <ul className="list-disc pl-4 text-xs text-muted-foreground">
                  {result.notices.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ClassView() {
  const { data: classes } = useApi<SchoolClass[]>("/api/classes");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");

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

  const {
    data: slots,
    loading,
    refetch,
  } = useApi<TimetableSlotSummary[]>(sectionId ? `/api/timetable-slots?sectionId=${sectionId}` : null);

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/api/timetable-slots/${id}`, { method: "DELETE" });
      toast.success("Timetable slot removed");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to remove timetable slot");
    }
  }

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
        {classId && sectionId && (
          <SlotFormDialog
            classId={classId}
            sectionId={sectionId}
            onSaved={refetch}
            trigger={
              <Button size="sm" variant="outline">
                <Pencil className="size-4" />
                Add slot manually
              </Button>
            }
          />
        )}
        {classId && <GenerateTimetableButton classId={classId} onGenerated={refetch} />}
      </div>

      {!classId || !sectionId ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Select a class and section to view its timetable.
          </CardContent>
        </Card>
      ) : loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <TimetableGrid
          slots={slots ?? []}
          showRoom
          renderActions={(slot) => (
            <>
              <SlotFormDialog
                classId={classId}
                sectionId={sectionId}
                slot={slot}
                onSaved={refetch}
                trigger={
                  <Button size="sm" variant="ghost" title="Edit">
                    <Pencil className="size-3.5" />
                  </Button>
                }
              />
              <ConfirmDialog
                trigger={
                  <Button size="sm" variant="ghost" title="Delete">
                    <Trash2 className="size-3.5" />
                  </Button>
                }
                title="Remove this timetable slot?"
                description="This can't be undone."
                confirmLabel="Remove"
                destructive
                onConfirm={() => handleDelete(slot.id)}
              />
            </>
          )}
        />
      )}
    </div>
  );
}

function TeacherView() {
  const { data: staff } = useApi<StaffOption[]>("/api/staff");
  const [staffId, setStaffId] = useState("");

  const { data: slots, loading } = useApi<TimetableSlotSummary[]>(
    staffId ? `/api/timetable-slots?staffId=${staffId}` : null,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="w-56">
        <Select
          items={(staff ?? []).map((s) => ({
            value: s.id,
            label: `${s.user.firstName} ${s.user.lastName}`,
          }))}
          value={staffId}
          onValueChange={(v) => setStaffId(v ?? "")}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select teacher" />
          </SelectTrigger>
          <SelectContent>
            {(staff ?? []).map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.user.firstName} {s.user.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {!staffId ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Select a teacher to view their schedule.
          </CardContent>
        </Card>
      ) : loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <TimetableGrid slots={slots ?? []} showClassSection showRoom />
      )}
    </div>
  );
}

function RoomView() {
  const { data: rooms } = useApi<Room[]>("/api/rooms");
  const [roomId, setRoomId] = useState("");

  const { data: slots, loading } = useApi<TimetableSlotSummary[]>(
    roomId ? `/api/timetable-slots?roomId=${roomId}` : null,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="w-56">
        <Select
          items={(rooms ?? []).map((r) => ({ value: r.id, label: r.name }))}
          value={roomId}
          onValueChange={(v) => setRoomId(v ?? "")}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select room" />
          </SelectTrigger>
          <SelectContent>
            {(rooms ?? []).map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
                {r.type === "LAB" && <Badge variant="secondary">Lab</Badge>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {!roomId ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Select a room to view its schedule.
          </CardContent>
        </Card>
      ) : loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <TimetableGrid slots={slots ?? []} showClassSection />
      )}
    </div>
  );
}

function MyScheduleView() {
  const { data: slots, loading } = useApi<TimetableSlotSummary[]>("/api/me/timetable");

  if (loading) return <Skeleton className="h-64 rounded-xl" />;
  if (!slots || slots.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No timetable has been set up for you yet.
        </CardContent>
      </Card>
    );
  }
  return <TimetableGrid slots={slots} showClassSection showRoom />;
}

function AdminView() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <GenerateTimetableButton onGenerated={() => setRefreshKey((k) => k + 1)} />
      </div>
      <Tabs defaultValue="class" key={refreshKey}>
        <TabsList>
          <TabsTrigger value="class">Class / section</TabsTrigger>
          <TabsTrigger value="teacher">Teacher</TabsTrigger>
          <TabsTrigger value="room">Room</TabsTrigger>
        </TabsList>
        <TabsContent value="class" className="mt-4">
          <ClassView />
        </TabsContent>
        <TabsContent value="teacher" className="mt-4">
          <TeacherView />
        </TabsContent>
        <TabsContent value="room" className="mt-4">
          <RoomView />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function TimetablePage() {
  const { user } = useAuth();
  if (!user) return null;

  const canManage = ADMIN_ROLES.includes(user.role);

  return (
    <div>
      <PageHeader
        title="Timetable"
        description={
          canManage
            ? "Generate the school's weekly schedule, or view/adjust it by class, teacher, or room"
            : "Weekly class schedule"
        }
      />
      {canManage ? <AdminView /> : <MyScheduleView />}
    </div>
  );
}
