"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { VehicleDialog } from "./vehicle-dialog";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { Vehicle } from "./types";

export function VehiclesTab() {
  const { data: vehicles, loading, refetch } = useApi<Vehicle[]>("/api/vehicles");

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/api/vehicles/${id}`, { method: "DELETE" });
      toast.success("Vehicle deleted");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete vehicle");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <VehicleDialog
          onSaved={refetch}
          trigger={
            <Button size="sm">
              <Plus className="size-4" />
              Add vehicle
            </Button>
          }
        />
      </div>
      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !vehicles || vehicles.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No vehicles yet. Add one to start creating routes.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Registration no.</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.registrationNo}</TableCell>
                  <TableCell>{v.capacity}</TableCell>
                  <TableCell>{v.driverName}</TableCell>
                  <TableCell className="text-muted-foreground">{v.driverPhone}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <VehicleDialog
                        vehicle={v}
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
                        title="Delete this vehicle?"
                        description="Only possible if it isn't assigned to any route."
                        confirmLabel="Delete"
                        destructive
                        onConfirm={() => handleDelete(v.id)}
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
