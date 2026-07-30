"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { AnnouncementCard, type AnnouncementSummary } from "@/components/dashboard/announcement-card";
import { AnnouncementFormDialog } from "@/components/announcements/announcement-form-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";

const CREATE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"];
const EDIT_ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"];

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const { data, loading, error, refetch } = useApi<AnnouncementSummary[]>("/api/announcements");
  const canCreate = !!user && CREATE_ROLES.includes(user.role);

  function canModify(a: AnnouncementSummary) {
    return !!user && (user.id === a.creator.id || EDIT_ADMIN_ROLES.includes(user.role));
  }

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/api/announcements/${id}`, { method: "DELETE" });
      toast.success("Announcement deleted");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete announcement");
    }
  }

  return (
    <div>
      <PageHeader
        title="Announcements"
        description="School-wide, role, and class updates"
        action={
          canCreate && (
            <AnnouncementFormDialog
              onSaved={refetch}
              trigger={
                <Button size="sm">
                  <Plus className="size-4" />
                  New announcement
                </Button>
              }
            />
          )
        }
      />

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">{error}</CardContent>
        </Card>
      ) : !data || data.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No announcements yet.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {data.map((a) => (
            <AnnouncementCard
              key={a.id}
              announcement={a}
              actions={
                canModify(a) ? (
                  <>
                    <AnnouncementFormDialog
                      announcement={a}
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
                      title="Delete this announcement?"
                      description="This can't be undone."
                      confirmLabel="Delete"
                      destructive
                      onConfirm={() => handleDelete(a.id)}
                    />
                  </>
                ) : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
