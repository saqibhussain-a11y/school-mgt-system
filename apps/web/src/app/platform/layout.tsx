import type { ReactNode } from "react";
import { PlatformAuthProvider } from "@/lib/platform-auth-context";
import { PlatformShell } from "@/components/layout/platform-shell";

export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <PlatformAuthProvider>
      <PlatformShell>{children}</PlatformShell>
    </PlatformAuthProvider>
  );
}
