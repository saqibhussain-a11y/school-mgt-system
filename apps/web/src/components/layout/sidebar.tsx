"use client";

import { GraduationCap } from "lucide-react";
import { NavList } from "./nav-list";
import { visibleNavItems } from "@/lib/nav-config";
import { useAuth } from "@/lib/auth-context";

export function Sidebar() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <GraduationCap className="size-5" />
        </div>
        <span className="font-semibold text-sidebar-foreground">SMS</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <NavList items={visibleNavItems(user.role)} />
      </div>
    </aside>
  );
}
