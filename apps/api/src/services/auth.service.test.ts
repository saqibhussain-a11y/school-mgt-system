import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma, Role } from "@sms/db";

const queueEmails = vi.hoisted(() => vi.fn());
vi.mock("../lib/queue", () => ({ queueEmails }));

import { authService } from "./auth.service";
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
