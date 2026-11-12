"use client";

import { useEffect, useState, type FormEvent } from "react";
import { LocateFixed } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useApi } from "@/lib/use-api";

interface Settings {
  officeLat: number | null;
  officeLng: number | null;
  radiusMeters: number;
  blockOutsideRadius: boolean;
  checkInWindowStart: string | null;
  checkInWindowEnd: string | null;
  checkOutWindowStart: string | null;
  checkOutWindowEnd: string | null;
}

export function StaffAttendanceSettingsTab() {
  const { data: settings, loading, refetch } = useApi<Settings>("/api/staff-attendance-settings");
  const [values, setValues] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (settings) setValues(settings);
  }, [settings]);

  function useCurrentLocation() {
    if (!("geolocation" in navigator)) {
      toast.error("This browser doesn't support geolocation");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setValues((prev) =>
          prev ? { ...prev, officeLat: pos.coords.latitude, officeLng: pos.coords.longitude } : prev,
        );
      },
      () => {
        setLocating(false);
        toast.error("Couldn't get your current location");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!values) return;
    setSaving(true);
    try {
      await apiFetch("/api/staff-attendance-settings", { method: "PATCH", body: JSON.stringify(values) });
      toast.success("Settings updated");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !values) {
    return <Skeleton className="h-64 rounded-xl" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Check-in/out settings</CardTitle>
        <CardDescription>
          All times are Pakistan Standard Time. Leave the office location blank to turn off location checks,
          and leave a window blank to allow that action at any time.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label>Office location</Label>
              <Button type="button" size="sm" variant="outline" onClick={useCurrentLocation} disabled={locating}>
                <LocateFixed className="size-3.5" />
                {locating ? "Locating…" : "Use my current location"}
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="sa-lat">Latitude</Label>
                <Input
                  id="sa-lat"
                  type="number"
                  step="any"
                  value={values.officeLat ?? ""}
                  onChange={(e) =>
                    setValues({ ...values, officeLat: e.target.value === "" ? null : Number(e.target.value) })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="sa-lng">Longitude</Label>
                <Input
                  id="sa-lng"
                  type="number"
                  step="any"
                  value={values.officeLng ?? ""}
                  onChange={(e) =>
                    setValues({ ...values, officeLng: e.target.value === "" ? null : Number(e.target.value) })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="sa-radius">Radius (meters)</Label>
                <Input
                  id="sa-radius"
                  type="number"
                  min={20}
                  value={values.radiusMeters}
                  onChange={(e) => setValues({ ...values, radiusMeters: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>

          <fieldset className="flex flex-col gap-3" disabled={values.officeLat === null || values.officeLng === null}>
            <legend className="mb-3 text-sm font-medium">Outside the radius</legend>
            {[
              {
                block: false,
                title: "Allow and flag for review",
                detail:
                  "The check-in is saved with an \u201cOutside range\u201d flag and you get a notification. Safer when GPS is weak indoors.",
              },
              {
                block: true,
                title: "Block the check-in",
                detail:
                  "Staff can only check in or out within the radius. They see how far away they are. Use a radius of at least 100\u2013200 m, since phone GPS can drift.",
              },
            ].map((option) => (
              <label
                key={String(option.block)}
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:checked]:border-primary has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
              >
                <input
                  type="radio"
                  name="outside-radius"
                  className="mt-1 accent-primary"
                  checked={values.blockOutsideRadius === option.block}
                  onChange={() => setValues({ ...values, blockOutsideRadius: option.block })}
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{option.title}</span>
                  <span className="text-xs text-muted-foreground">{option.detail}</span>
                </span>
              </label>
            ))}
            {(values.officeLat === null || values.officeLng === null) && (
              <p className="text-xs text-muted-foreground">Set the office location first.</p>
            )}
          </fieldset>

          <div className="flex flex-col gap-3">
            <Label>Check-in window</Label>
            <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
              <Input
                type="time"
                aria-label="Check-in opens"
                value={values.checkInWindowStart ?? ""}
                onChange={(e) => setValues({ ...values, checkInWindowStart: e.target.value || null })}
              />
              <Input
                type="time"
                aria-label="Check-in closes"
                value={values.checkInWindowEnd ?? ""}
                onChange={(e) => setValues({ ...values, checkInWindowEnd: e.target.value || null })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Label>Check-out window</Label>
            <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
              <Input
                type="time"
                aria-label="Check-out opens"
                value={values.checkOutWindowStart ?? ""}
                onChange={(e) => setValues({ ...values, checkOutWindowStart: e.target.value || null })}
              />
              <Input
                type="time"
                aria-label="Check-out closes"
                value={values.checkOutWindowEnd ?? ""}
                onChange={(e) => setValues({ ...values, checkOutWindowEnd: e.target.value || null })}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Staff who checked in but haven&apos;t checked out get a reminder 30 minutes before the check-out window
              closes, or at 4:00 PM if there&apos;s no window.
            </p>
          </div>

          <div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
