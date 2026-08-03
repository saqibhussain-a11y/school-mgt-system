"use client";

import { useState, type FormEvent, type ReactElement } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { Route, Vehicle } from "./types";

export function RouteDialog({
  trigger,
  route,
  onSaved,
}: {
  trigger: ReactElement;
  route?: Route;
  onSaved: () => void;
}) {
  const isEdit = Boolean(route);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(route?.name ?? "");
  const [vehicleId, setVehicleId] = useState(route?.vehicleId ?? "");
  const [submitting, setSubmitting] = useState(false);

  const { data: vehicles } = useApi<Vehicle[]>(open ? "/api/vehicles" : null);

  function reset() {
    setName("");
    setVehicleId("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!vehicleId) return;
    setSubmitting(true);
    try {
      const body = { name, vehicleId };
      if (isEdit) {
        await apiFetch(`/api/routes/${route!.id}`, { method: "PATCH", body: JSON.stringify(body) });
        toast.success("Route updated");
      } else {
        await apiFetch("/api/routes", { method: "POST", body: JSON.stringify(body) });
        toast.success("Route created");
        reset();
      }
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save route");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit route" : "New route"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="rt-name">Route name</Label>
            <Input id="rt-name" placeholder="e.g. North Loop" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Vehicle</Label>
            <Select
              items={(vehicles ?? []).map((v) => ({ value: v.id, label: `${v.registrationNo} (${v.driverName})` }))}
              value={vehicleId}
              onValueChange={(v) => setVehicleId(v ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select vehicle" />
              </SelectTrigger>
              <SelectContent>
                {(vehicles ?? []).map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.registrationNo} ({v.driverName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!vehicleId || submitting}>
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Create route"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
