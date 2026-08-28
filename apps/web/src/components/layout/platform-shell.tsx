"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PlatformSidebar } from "./platform-sidebar";
import { PlatformTopbar } from "./platform-topbar";
import { usePlatformAuth } from "@/lib/platform-auth-context";

export function PlatformShell({ children }: { children: ReactNode }) {
  const { admin, loading } = usePlatformAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !admin) {
      router.replace("/platform-login");
    }
  }, [loading, admin, router]);

  if (loading || !admin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <PlatformSidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <PlatformTopbar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
