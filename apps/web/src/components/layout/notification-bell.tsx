"use client";

import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotifications } from "@/lib/notification-context";
import { formatRelativeTime } from "@/lib/format";
import type { NotificationDto } from "@sms/shared-types";

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const router = useRouter();

  function handleSelect(notification: NotificationDto) {
    if (!notification.isRead) markRead(notification.id);
    if (notification.link) router.push(notification.link);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="relative" aria-label="Notifications" />}
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-1.5 py-1">
          <span className="text-xs font-medium text-muted-foreground">Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead()}
              className="text-xs font-medium text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <p className="px-1.5 py-4 text-center text-sm text-muted-foreground">
            No notifications yet
          </p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                onClick={() => handleSelect(n)}
                className="flex flex-col items-start gap-0.5 whitespace-normal py-2"
              >
                <div className="flex w-full items-center gap-2">
                  {!n.isRead && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                  <span className={n.isRead ? "font-normal" : "font-medium"}>{n.title}</span>
                </div>
                {n.body && (
                  <span className="text-xs text-muted-foreground">{n.body}</span>
                )}
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(n.createdAt)}
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
