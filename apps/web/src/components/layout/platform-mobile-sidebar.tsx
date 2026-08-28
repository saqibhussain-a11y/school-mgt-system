"use client";

import { useState } from "react";
import { Menu, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NavList } from "./nav-list";
import { PLATFORM_NAV_ITEMS } from "@/lib/platform-nav-config";

export function PlatformMobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" />}
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
        <SheetHeader className="flex-row items-center gap-2 border-b border-sidebar-border px-5 py-4">
          <ShieldCheck className="size-6 shrink-0 text-sidebar-primary" />
          <SheetTitle className="text-sidebar-foreground">Platform</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-3">
          <NavList items={PLATFORM_NAV_ITEMS} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
