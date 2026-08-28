import { prisma, runAsPlatform } from "@sms/db";

export const platformAdminService = {
  findByEmail(email: string) {
    return runAsPlatform(() => prisma.platformAdmin.findUnique({ where: { email } }));
  },

  getById(id: string) {
    return runAsPlatform(() => prisma.platformAdmin.findUnique({ where: { id } }));
  },
};
