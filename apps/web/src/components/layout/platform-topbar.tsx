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
import { PlatformMobileSidebar } from "./platform-mobile-sidebar";
import { usePlatformAuth } from "@/lib/platform-auth-context";
import { initials } from "@/lib/format";
import { platformApiFetch } from "@/lib/platform-api-client";
import { ChangePasswordDialog } from "./change-password-dialog";

export function PlatformTopbar() {
  const { admin, logout } = usePlatformAuth();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  if (!admin) return null;

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 md:px-6">
      <PlatformMobileSidebar />
      <div className="flex-1" />
      <ThemeToggle />
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" className="flex items-center gap-2 px-2" />}>
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {initials(admin.firstName || "P", admin.lastName || "")}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium sm:inline">
            {admin.firstName} {admin.lastName}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex flex-col">
              <span className="font-medium">
                {admin.firstName} {admin.lastName}
              </span>
              <span className="text-xs font-normal text-muted-foreground">{admin.email}</span>
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
      <ChangePasswordDialog
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
        logout={logout}
        submit={(newPassword) =>
          platformApiFetch("/api/auth/platform-change-password", {
            method: "POST",
            body: JSON.stringify({ newPassword }),
          })
        }
      />
    </header>
  );
}
