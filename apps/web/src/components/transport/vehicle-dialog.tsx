"use client";

import { useState, type FormEvent, type ReactElement } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { Vehicle } from "./types";

export function VehicleDialog({
  trigger,
  vehicle,
  onSaved,
}: {
  trigger: ReactElement;
  vehicle?: Vehicle;
  onSaved: () => void;
}) {
  const isEdit = Boolean(vehicle);
  const [open, setOpen] = useState(false);
  const [registrationNo, setRegistrationNo] = useState(vehicle?.registrationNo ?? "");
  const [capacity, setCapacity] = useState(vehicle ? String(vehicle.capacity) : "");
  const [driverName, setDriverName] = useState(vehicle?.driverName ?? "");
  const [driverPhone, setDriverPhone] = useState(vehicle?.driverPhone ?? "");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setRegistrationNo("");
    setCapacity("");
    setDriverName("");
    setDriverPhone("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body = { registrationNo, capacity: Number(capacity), driverName, driverPhone };
      if (isEdit) {
        await apiFetch(`/api/vehicles/${vehicle!.id}`, { method: "PATCH", body: JSON.stringify(body) });
        toast.success("Vehicle updated");
      } else {
        await apiFetch("/api/vehicles", { method: "POST", body: JSON.stringify(body) });
        toast.success("Vehicle added");
        reset();
      }
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save vehicle");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit vehicle" : "Add vehicle"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="vh-reg">Registration no.</Label>
              <Input id="vh-reg" required value={registrationNo} onChange={(e) => setRegistrationNo(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="vh-capacity">Capacity</Label>
              <Input
                id="vh-capacity"
                type="number"
                min={1}
                required
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="vh-driver-name">Driver name</Label>
            <Input id="vh-driver-name" required value={driverName} onChange={(e) => setDriverName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="vh-driver-phone">Driver phone</Label>
            <Input id="vh-driver-phone" required value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Add vehicle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
