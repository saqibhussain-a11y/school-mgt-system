"use client";

import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

export function ImpersonationBanner() {
  const { user, logout } = useAuth();
  const router = useRouter();
  if (!user?.impersonatedBy) return null;

  async function exit() {
    await logout();
    router.replace("/platform");
  }

  return (
    <div className="flex shrink-0 items-center justify-center gap-3 bg-amber-500/15 px-4 py-1.5 text-sm text-amber-700 dark:text-amber-400">
      <ShieldAlert className="size-4 shrink-0" />
      <span>Viewing as this school&apos;s admin, for support</span>
      <Button variant="link" size="sm" className="h-auto p-0 text-amber-700 underline dark:text-amber-400" onClick={exit}>
        Exit
      </Button>
    </div>
  );
}
