import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma, Role, runAsPlatform } from "@sms/db";

const queueEmails = vi.hoisted(() => vi.fn());
vi.mock("../lib/queue", () => ({ queueEmails }));

import { authService } from "./auth.service";
import { hashPassword } from "../lib/password";
import { createTestSchool, createTestUser, withTenant } from "../test/helpers";

async function activeUser() {
  const schoolId = await createTestSchool();
  const user = await createTestUser(schoolId, Role.TEACHER);
  await withTenant(schoolId, () => prisma.user.update({ where: { id: user.id }, data: { isActivated: true } }));
  return { schoolId, user };
}

beforeEach(() => {
  queueEmails.mockReset();
});

describe("authService.changePassword", () => {
  it("sets a new password without the old one, signs out every session and emails a notice", async () => {
    const { schoolId, user } = await activeUser();
    await authService.changePassword(schoolId, user.id, "BrandNew#2026");
    const session = await authService.login(schoolId, user.email, "BrandNew#2026");

    await authService.changePassword(schoolId, user.id, "Second#2026");

    await expect(authService.refresh(session.refreshToken)).rejects.toMatchObject({ status: 401 });
    await expect(authService.login(schoolId, user.email, "BrandNew#2026")).rejects.toMatchObject({ status: 401 });
    await expect(authService.login(schoolId, user.email, "Second#2026")).resolves.toHaveProperty("accessToken");
  });
});

describe("authService.requestPasswordReset", () => {
  it("queues the code email instead of sending it inline", async () => {
    const { schoolId, user } = await activeUser();
    await authService.requestPasswordReset(schoolId, user.email);
    expect(queueEmails).toHaveBeenCalledWith([expect.objectContaining({ to: user.email })]);
  });

  it("still succeeds when the email can't be queued", async () => {
    const { schoolId, user } = await activeUser();
    queueEmails.mockRejectedValueOnce(new Error("connect EHOSTUNREACH"));
    await expect(authService.requestPasswordReset(schoolId, user.email)).resolves.toBeUndefined();
    const codes = await withTenant(schoolId, () => prisma.passwordResetOtp.count({ where: { userId: user.id } }));
    expect(codes).toBe(1);
  });
});

describe("authService.platformChangePassword", () => {
  it("changes the Super Admin password, signs out every session and writes an audit entry", async () => {
    const email = `${randomUUID()}@platform.test`;
    const admin = await runAsPlatform(async () =>
      prisma.platformAdmin.create({
        data: { email, passwordHash: await hashPassword("Original#2026"), firstName: "P", lastName: "A" },
      }),
    );
    const session = await authService.platformLogin(email, "Original#2026");

    await authService.platformChangePassword(admin.id, "Rotated#2026");

    await expect(authService.platformRefresh(session.refreshToken)).rejects.toMatchObject({ status: 401 });
    await expect(authService.platformLogin(email, "Original#2026")).rejects.toMatchObject({ status: 401 });
    await expect(authService.platformLogin(email, "Rotated#2026")).resolves.toHaveProperty("accessToken");
    const audit = await runAsPlatform(() =>
      prisma.platformAuditLog.findMany({ where: { platformAdminId: admin.id } }),
    );
    expect(audit.map((a) => a.action)).toEqual(["platform_admin.change_password"]);
    expect(queueEmails).toHaveBeenCalledWith([expect.objectContaining({ to: email })]);
  });
});
