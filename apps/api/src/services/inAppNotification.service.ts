import { prisma } from "@sms/db";
import { emitToUser } from "../lib/socket";

export interface NotifyData {
  type: string;
  title: string;
  body?: string;
  link?: string;
}

export const inAppNotificationService = {
  async notify(schoolId: string, userId: string, data: NotifyData) {
    const notification = await prisma.notification.create({ data: { schoolId, userId, ...data } });
    emitToUser(userId, "notification:new", notification);
    return notification;
  },

  // Individual creates (not createMany) so each row comes back with an id to
  // emit over its own user's socket room — createMany doesn't return rows.
  async notifyMany(schoolId: string, userIds: string[], data: NotifyData) {
    const unique = [...new Set(userIds)];
    if (!unique.length) return [];
    const created = await prisma.$transaction(
      unique.map((userId) => prisma.notification.create({ data: { schoolId, userId, ...data } })),
    );
    created.forEach((n) => emitToUser(n.userId, "notification:new", n));
    return created;
  },

  list(schoolId: string, userId: string, limit = 30) {
    return prisma.notification.findMany({
      where: { schoolId, userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  unreadCount(schoolId: string, userId: string) {
    return prisma.notification.count({ where: { schoolId, userId, isRead: false } });
  },

  async markRead(schoolId: string, userId: string, id: string) {
    const existing = await prisma.notification.findFirst({ where: { id, schoolId, userId } });
    if (!existing) return null;
    return prisma.notification.update({ where: { id }, data: { isRead: true } });
  },

  async markAllRead(schoolId: string, userId: string) {
    await prisma.notification.updateMany({ where: { schoolId, userId, isRead: false }, data: { isRead: true } });
  },
};
