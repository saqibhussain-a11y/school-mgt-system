import { prisma, Role } from "@sms/db";
import { getDownloadUrl, putObject, deleteObject } from "../lib/storage";
import { HttpError } from "../middleware/errorHandler";

export const userService = {
  findByEmail(schoolId: string, email: string) {
    return prisma.user.findUnique({
      where: { schoolId_email: { schoolId, email } },
    });
  },

  getById(schoolId: string, id: string) {
    return prisma.user.findFirst({ where: { id, schoolId } });
  },

  async updatePassword(schoolId: string, id: string, passwordHash: string) {
    await prisma.user.updateMany({ where: { id, schoolId }, data: { passwordHash, isActivated: true } });
  },

  listByRole(schoolId: string, role: Role) {
    return prisma.user.findMany({
      where: { schoolId, role },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  },

  async avatarUrl(user: { avatarKey: string | null }) {
    return user.avatarKey ? getDownloadUrl(user.avatarKey) : null;
  },

  async getProfile(schoolId: string, userId: string) {
    const user = await prisma.user.findFirst({ where: { id: userId, schoolId } });
    if (!user) throw new HttpError(404, "User not found");

    // PARENT's phone/address already live on Guardian (used by fee/notification
    // flows elsewhere) — read from there instead of duplicating the fields.
    let phone = user.phone;
    let address = user.address;
    if (user.role === Role.PARENT) {
      const guardian = await prisma.guardian.findFirst({ where: { userId, schoolId } });
      phone = guardian?.phone ?? null;
      address = guardian?.address ?? null;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      phone,
      address,
      avatarUrl: await this.avatarUrl(user),
    };
  },

  async updateProfile(
    schoolId: string,
    userId: string,
    data: { firstName: string; lastName: string; email: string; phone?: string; address?: string },
  ) {
    const user = await prisma.user.findFirst({ where: { id: userId, schoolId } });
    if (!user) throw new HttpError(404, "User not found");

    if (data.email !== user.email) {
      const clash = await prisma.user.findUnique({ where: { schoolId_email: { schoolId, email: data.email } } });
      if (clash) throw new HttpError(409, "Another account already uses this email");
    }

    if (user.role === Role.PARENT) {
      await prisma.guardian.updateMany({
        where: { userId, schoolId },
        data: { phone: data.phone ?? null, address: data.address ?? null },
      });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        ...(user.role === Role.PARENT ? {} : { phone: data.phone ?? null, address: data.address ?? null }),
      },
    });

    return this.getProfile(schoolId, userId);
  },

  async setAvatar(schoolId: string, userId: string, file: { buffer: Buffer; ext: string; contentType: string }) {
    const user = await prisma.user.findFirst({ where: { id: userId, schoolId } });
    if (!user) throw new HttpError(404, "User not found");

    const key = `schools/${schoolId}/avatars/${userId}/${Date.now()}${file.ext}`;
    await putObject(key, file.buffer, file.contentType);
    if (user.avatarKey) await deleteObject(user.avatarKey).catch(() => {});

    await prisma.user.update({ where: { id: userId }, data: { avatarKey: key } });
    return { avatarUrl: await getDownloadUrl(key) };
  },

  async removeAvatar(schoolId: string, userId: string) {
    const user = await prisma.user.findFirst({ where: { id: userId, schoolId } });
    if (!user) throw new HttpError(404, "User not found");
    if (user.avatarKey) await deleteObject(user.avatarKey).catch(() => {});
    await prisma.user.update({ where: { id: userId }, data: { avatarKey: null } });
  },
};
