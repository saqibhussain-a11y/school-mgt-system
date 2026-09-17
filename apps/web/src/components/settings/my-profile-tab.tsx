"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/shared/user-avatar";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth-context";
import type { ProfileDto } from "@sms/shared-types";

export function MyProfileTab() {
  const { refreshUser } = useAuth();
  const { data: profile, loading, refetch } = useApi<ProfileDto>("/api/me/profile");
  const [values, setValues] = useState<ProfileDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) setValues(profile);
  }, [profile]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!values) return;
    setSaving(true);
    try {
      await apiFetch("/api/me/profile", {
        method: "PATCH",
        body: JSON.stringify({
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          phone: values.phone ?? "",
          address: values.address ?? "",
        }),
      });
      toast.success("Profile updated");
      refetch();
      refreshUser();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await apiFetch("/api/me/avatar", { method: "POST", body: formData });
      toast.success("Photo updated");
      refetch();
      refreshUser();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to upload photo");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemovePhoto() {
    setUploading(true);
    try {
      await apiFetch("/api/me/avatar", { method: "DELETE" });
      toast.success("Photo removed");
      refetch();
      refreshUser();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to remove photo");
    } finally {
      setUploading(false);
    }
  }

  if (loading || !values) {
    return <Skeleton className="h-80 rounded-xl" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My profile</CardTitle>
        <CardDescription>Update your personal details and photo.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <UserAvatar
            firstName={values.firstName}
            lastName={values.lastName}
            avatarUrl={values.avatarUrl}
            size="lg"
            className="size-16 text-lg"
          />
          <div className="flex flex-col gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-3.5" />
                {uploading ? "Uploading…" : "Upload photo"}
              </Button>
              {values.avatarUrl && (
                <Button type="button" size="sm" variant="ghost" disabled={uploading} onClick={handleRemovePhoto}>
                  <Trash2 className="size-3.5" />
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">JPG, PNG, WEBP, or GIF. Max 3MB.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="mp-first-name">First name</Label>
              <Input
                id="mp-first-name"
                required
                value={values.firstName}
                onChange={(e) => setValues({ ...values, firstName: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="mp-last-name">Last name</Label>
              <Input
                id="mp-last-name"
                required
                value={values.lastName}
                onChange={(e) => setValues({ ...values, lastName: e.target.value })}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="mp-email">Email</Label>
            <Input
              id="mp-email"
              type="email"
              required
              value={values.email}
              onChange={(e) => setValues({ ...values, email: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="mp-phone">Phone</Label>
              <Input
                id="mp-phone"
                value={values.phone ?? ""}
                onChange={(e) => setValues({ ...values, phone: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="mp-address">Address</Label>
              <Input
                id="mp-address"
                value={values.address ?? ""}
                onChange={(e) => setValues({ ...values, address: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
