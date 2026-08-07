"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NavList } from "./nav-list";
import { visibleNavItems } from "@/lib/nav-config";
import { useAuth } from "@/lib/auth-context";

export function MobileSidebar() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  if (!user) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" />}
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="flex-row items-center gap-2 border-b border-sidebar-border px-5 py-4">
          <img src="/Logo.png" alt="" className="size-9 shrink-0 rounded-full object-cover" />
          <SheetTitle>School Management System</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-3">
          <NavList items={visibleNavItems(user.role)} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
