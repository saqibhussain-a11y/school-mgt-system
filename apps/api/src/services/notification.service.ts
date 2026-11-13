import { logger } from "../lib/logger";
import { queueEmails } from "../lib/queue";
import { otpEmail, welcomeEmail, passwordChangedEmail, accountInviteEmail } from "../lib/emailTemplates";

function loginUrl() {
  return `${process.env.WEB_APP_URL ?? "http://localhost:3000"}/login`;
}

function claimAccountUrl(schoolId: string, email: string) {
  const base = process.env.WEB_APP_URL ?? "http://localhost:3000";
  return `${base}/forgot-password?schoolId=${encodeURIComponent(schoolId)}&email=${encodeURIComponent(email)}`;
}

// Every account email goes through the email queue rather than SMTP inline:
// the request returns at once, the worker retries (3 attempts with backoff),
// and an SMTP outage can't turn forgot-password or account creation into a
// 500. Best-effort — a failure to queue is logged, never thrown, so the
// response is also identical whether or not the account exists.
async function send(email: string, { subject, html }: { subject: string; html: string }, what: string) {
  try {
    await queueEmails([{ to: email, subject, html }]);
  } catch (err) {
    logger.error({ err, email }, `Failed to queue ${what} email`);
  }
}

export const notificationService = {
  notifyPasswordResetOtp(email: string, otp: string) {
    return send(email, otpEmail(otp), "password reset");
  },

  // The on-screen "share these credentials" panel stays the source of truth.
  notifyNewAccount(email: string, firstName: string, password: string) {
    return send(email, welcomeEmail(firstName, email, password, loginUrl()), "welcome");
  },

  notifyAccountInvite(schoolId: string, email: string, firstName: string, otp: string) {
    return send(email, accountInviteEmail(firstName, otp, claimAccountUrl(schoolId, email)), "account invite");
  },

  notifyPasswordChanged(email: string, reason: "admin_reset" | "otp_reset" | "self_change") {
    return send(email, passwordChangedEmail(reason), "password-changed notice");
  },
};
