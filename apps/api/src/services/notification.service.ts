import { sendMail } from "../lib/mailer";
import { otpEmail, welcomeEmail, passwordChangedEmail } from "../lib/emailTemplates";

function loginUrl() {
  return `${process.env.WEB_APP_URL ?? "http://localhost:3000"}/login`;
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
      console.error(`[mail] Failed to send welcome email to ${email}:`, err);
    }
  },

  async notifyPasswordChanged(email: string, reason: "admin_reset" | "otp_reset") {
    try {
      const { subject, html } = passwordChangedEmail(reason);
      await sendMail(email, subject, html);
    } catch (err) {
      console.error(`[mail] Failed to send password-changed notice to ${email}:`, err);
    }
  },
};
