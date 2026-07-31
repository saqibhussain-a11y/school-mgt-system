"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import type { NotificationDto } from "@sms/shared-types";
import { apiFetch, API_URL, tokenStorage } from "./api-client";
import { useAuth } from "./auth-context";

interface NotificationContextValue {
  notifications: NotificationDto[];
  unreadCount: number;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refetch: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

// Owns the Socket.io connection's lifetime — one connect per login, one
// disconnect per logout, so a component unmount/remount (e.g. route change)
// doesn't churn the socket. Handshake auth carries the same access token
// read from localStorage as apiFetch, mirroring the REST API's Bearer check.
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef<Socket | null>(null);

  const refetch = useCallback(async () => {
    if (!user) return;
    const [list, unread] = await Promise.all([
      apiFetch<NotificationDto[]>("/api/notifications"),
      apiFetch<{ count: number }>("/api/notifications/unread-count"),
    ]);
    setNotifications(list);
    setUnreadCount(unread.count);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    refetch();

    const tokens = tokenStorage.get();
    if (!tokens) return;

    const socket = io(API_URL, { auth: { token: tokens.accessToken } });
    socketRef.current = socket;

    socket.on("notification:new", (notification: NotificationDto) => {
      setNotifications((prev) => [notification, ...prev].slice(0, 30));
      setUnreadCount((prev) => prev + 1);
      toast(notification.title, { description: notification.body ?? undefined });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    await apiFetch(`/api/notifications/${id}/read`, { method: "PATCH" }).catch(() => undefined);
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    await apiFetch("/api/notifications/read-all", { method: "PATCH" }).catch(() => undefined);
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markRead, markAllRead, refetch }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within a NotificationProvider");
  return ctx;
}
