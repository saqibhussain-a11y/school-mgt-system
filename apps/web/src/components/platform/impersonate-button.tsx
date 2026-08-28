"use client";

import { Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { platformApiFetch } from "@/lib/platform-api-client";
import { tokenStorage, ApiError } from "@/lib/api-client";

export function ImpersonateButton({ schoolId, schoolName }: { schoolId: string; schoolName: string }) {
  async function handleConfirm() {
    try {
      const { accessToken, schoolId: targetSchoolId } = await platformApiFetch<{
        accessToken: string;
        schoolId: string;
      }>(`/api/platform/schools/${schoolId}/impersonate`, { method: "POST" });
      // No refresh token exists for an impersonation session — the access
      // token's own 15m expiry is the session's only lifetime, after which
      // any refresh attempt fails and the tenant app logs it out naturally.
      tokenStorage.set(accessToken, "impersonation-session", targetSchoolId);
      window.location.href = "/dashboard";
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to start impersonation session");
    }
  }

  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm">
          <Eye className="size-4" />
          View as school admin
        </Button>
      }
      title={`View ${schoolName} as its admin?`}
      description="This opens that school's dashboard as its admin, for support. The session expires automatically in 15 minutes, and this action is logged."
      confirmLabel="View as admin"
      onConfirm={handleConfirm}
    />
  );
}
