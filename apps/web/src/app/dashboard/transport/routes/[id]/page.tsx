"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { RouteDialog } from "@/components/transport/route-dialog";
import { AssignStudentDialog } from "@/components/transport/assign-student-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { Route, StudentRoute } from "@/components/transport/types";

export default function RouteDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const { data: route, loading, refetch } = useApi<Route>(`/api/routes/${params.id}`);
  const { data: assignments, refetch: refetchAssignments } = useApi<StudentRoute[]>(`/api/student-routes/route/${params.id}`);

  async function handleDeleteRoute() {
    try {
      await apiFetch(`/api/routes/${params.id}`, { method: "DELETE" });
      toast.success("Route deleted");
      router.push("/dashboard/transport");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete route");
    }
  }

  async function handleUnassign(studentId: string) {
    try {
      await apiFetch(`/api/student-routes/student/${studentId}`, { method: "DELETE" });
      toast.success("Student removed from route");
      refetch();
      refetchAssignments();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to remove student");
    }
  }

  if (loading || !route) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/transport")}>
          <ArrowLeft className="size-4" />
          Back to transport
        </Button>
        <Skeleton className="mt-4 h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-2" onClick={() => router.push("/dashboard/transport")}>
        <ArrowLeft className="size-4" />
        Back to transport
      </Button>
      <PageHeader
        title={route.name}
        description={`${route.vehicle.registrationNo} · ${route.vehicle.driverName}`}
        action={
          <div className="flex gap-2">
            <RouteDialog
              route={route}
              onSaved={refetch}
              trigger={
                <Button size="sm" variant="outline">
                  <Pencil className="size-4" />
                  Edit
                </Button>
              }
            />
            <ConfirmDialog
              trigger={
                <Button size="sm" variant="destructive">
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              }
              title="Delete this route?"
              description="Only possible if no students are currently assigned to it."
              confirmLabel="Delete"
              destructive
              onConfirm={handleDeleteRoute}
            />
          </div>
        }
      />

      <div className="flex flex-col gap-4">
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 py-4 sm:grid-cols-4">
            <div>
              <div className="text-xs text-muted-foreground">Vehicle</div>
              <div className="text-lg font-semibold">{route.vehicle.registrationNo}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Capacity</div>
              <div className="text-lg font-semibold">{route.vehicle.capacity}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Driver</div>
              <div className="text-lg font-semibold">{route.vehicle.driverName}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Driver phone</div>
              <div className="text-lg font-semibold">{route.vehicle.driverPhone}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Assigned students</CardTitle>
            <AssignStudentDialog
              routeId={route.id}
              onAssigned={() => {
                refetch();
                refetchAssignments();
              }}
              trigger={<Button size="sm">Assign student</Button>}
            />
          </CardHeader>
          <CardContent className="p-0">
            {!assignments || assignments.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">No students assigned yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Pickup stop</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">
                        {a.student.user.firstName} {a.student.user.lastName}
                        <div className="text-xs text-muted-foreground">{a.student.admissionNo}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{a.pickupStop || "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" title="Remove from route" onClick={() => handleUnassign(a.studentId)}>
                          <UserMinus className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
