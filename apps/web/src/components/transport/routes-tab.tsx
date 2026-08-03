"use client";

import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RouteDialog } from "./route-dialog";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { Route } from "./types";

export function RoutesTab() {
  const router = useRouter();
  const { data: routes, loading, refetch } = useApi<Route[]>("/api/routes");

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/api/routes/${id}`, { method: "DELETE" });
      toast.success("Route deleted");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete route");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <RouteDialog
          onSaved={refetch}
          trigger={
            <Button size="sm">
              <Plus className="size-4" />
              New route
            </Button>
          }
        />
      </div>
      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !routes || routes.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No routes yet. Add a vehicle first, then create a route.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Route</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Students</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routes.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => router.push(`/dashboard/transport/routes/${r.id}`)}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.vehicle.registrationNo}</TableCell>
                  <TableCell>{r.vehicle.driverName}</TableCell>
                  <TableCell>{r._count.studentRoutes}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <RouteDialog
                        route={r}
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
                        title="Delete this route?"
                        description="Only possible if no students are currently assigned to it."
                        confirmLabel="Delete"
                        destructive
                        onConfirm={() => handleDelete(r.id)}
                      />
                    </div>
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
