"use client";

import { useState } from "react";
import { KeyRound, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { NotificationBell } from "./notification-bell";
import { MobileSidebar } from "./mobile-sidebar";
import { ChangePasswordDialog } from "./change-password-dialog";
import { useAuth } from "@/lib/auth-context";
import { formatRole, initials } from "@/lib/format";

export function Topbar() {
  const { user, logout } = useAuth();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  if (!user) return null;

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 md:px-6">
      <MobileSidebar />
      <div className="flex-1" />
      <NotificationBell />
      <ThemeToggle />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" className="flex items-center gap-2 px-2" />
          }
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {initials(user.firstName || "U", user.lastName || "")}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium sm:inline">
            {user.firstName} {user.lastName}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex flex-col">
              <span className="font-medium">
                {user.firstName} {user.lastName}
              </span>
              <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
              <span className="mt-1 inline-flex w-fit items-center rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                {formatRole(user.role)}
              </span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
            <KeyRound className="size-4" />
            Change password
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => logout()}>
            <LogOut className="size-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </header>
  );
}
