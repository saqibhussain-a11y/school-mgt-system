"use client";

import { useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NavList } from "./nav-list";
import { visibleNavItems } from "@/lib/nav-config";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "sms:sidebar-collapsed";

export function Sidebar() {
  const { user } = useAuth();
  // Not cleared on logout — same device/browser-preference treatment as the
  // palette and dark/light mode choices.
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY) === "1",
  );

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  }

  if (!user) return null;

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 md:flex",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center gap-2 border-b border-sidebar-border px-5",
          collapsed && "justify-center px-0",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a static
            public-folder brand asset, not an optimizable content image (see
            the same call made in login/page.tsx). */}
        <img src="/Logo.png" alt="" className="size-9 shrink-0 rounded-full object-cover" />
        {!collapsed && <span className="font-semibold text-sidebar-foreground">SMS</span>}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <NavList items={visibleNavItems(user.role)} collapsed={collapsed} />
      </div>
      <div className="border-t border-sidebar-border p-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4 shrink-0" />
          ) : (
            <PanelLeftClose className="size-4 shrink-0" />
          )}
          {!collapsed && "Collapse sidebar"}
        </button>
      </div>
    </aside>
  );
}
