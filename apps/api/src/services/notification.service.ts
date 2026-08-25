import { sendMail } from "../lib/mailer";
import { logger } from "../lib/logger";
import { otpEmail, welcomeEmail, passwordChangedEmail, accountInviteEmail } from "../lib/emailTemplates";

function loginUrl() {
  return `${process.env.WEB_APP_URL ?? "http://localhost:3000"}/login`;
}

function claimAccountUrl(email: string) {
  const base = process.env.WEB_APP_URL ?? "http://localhost:3000";
  return `${base}/forgot-password?email=${encodeURIComponent(email)}`;
}

export const notificationService = {
  async notifyPasswordResetOtp(email: string, otp: string) {
    const { subject, html } = otpEmail(otp);
    await sendMail(email, subject, html);
  },

  // Best-effort — a failed send should never block account creation. The
  // on-screen "share these credentials" panel is still the source of truth.
  async notifyNewAccount(email: string, firstName: string, password: string) {
    try {
      const { subject, html } = welcomeEmail(firstName, email, password, loginUrl());
      await sendMail(email, subject, html);
    } catch (err) {
      logger.error({ err, email }, "Failed to send welcome email");
    }
  },

  // Best-effort, same as notifyNewAccount — a failed send shouldn't block
  // the admin's "send invite" action.
  async notifyAccountInvite(email: string, firstName: string, otp: string) {
    try {
      const { subject, html } = accountInviteEmail(firstName, otp, claimAccountUrl(email));
      await sendMail(email, subject, html);
    } catch (err) {
      logger.error({ err, email }, "Failed to send account invite email");
    }
  },

  async notifyPasswordChanged(email: string, reason: "admin_reset" | "otp_reset") {
    try {
      const { subject, html } = passwordChangedEmail(reason);
      await sendMail(email, subject, html);
    } catch (err) {
      logger.error({ err, email }, "Failed to send password-changed notice");
    }
  },
};
