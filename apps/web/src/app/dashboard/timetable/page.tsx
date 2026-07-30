"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
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
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SlotFormDialog } from "@/components/timetable/slot-form-dialog";
import { TimetableGrid, type TimetableSlotSummary } from "@/components/timetable/timetable-grid";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { SchoolClass } from "@/components/academics/classes-tab";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"];

interface Section {
  id: string;
  name: string;
}

function BuilderView() {
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
              <Button size="sm">
                <Plus className="size-4" />
                Add slot
              </Button>
            }
          />
        )}
      </div>

      {!classId || !sectionId ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Select a class and section to build its timetable.
          </CardContent>
        </Card>
      ) : loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <TimetableGrid
          slots={slots ?? []}
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
  return <TimetableGrid slots={slots} showClassSection />;
}

export default function TimetablePage() {
  const { user } = useAuth();
  if (!user) return null;

  const canManage = ADMIN_ROLES.includes(user.role);

  return (
    <div>
      <PageHeader title="Timetable" description="Weekly class schedule" />
      {canManage ? <BuilderView /> : <MyScheduleView />}
    </div>
  );
}
