import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "./logger";

let transporterPromise: Promise<Transporter> | null = null;

// No SMTP_HOST configured (local dev) — auto-provision a disposable Ethereal
// inbox instead of a real one, so email sending is exercised for real end to
// end. Nothing actually leaves the building; sendMail logs a preview link.
// Without these, nodemailer's own defaults (~2min connect, ~10min socket)
// mean a hung SMTP connection can hold a request open for minutes — a
// forgot-password request would just sit there instead of failing fast.
const TRANSPORT_TIMEOUTS = { connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000 };

async function createTransporter(): Promise<Transporter> {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
      ...TRANSPORT_TIMEOUTS,
    });
  }

  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: { user: testAccount.user, pass: testAccount.pass },
    ...TRANSPORT_TIMEOUTS,
  });
}

function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = createTransporter();
  }
  return transporterPromise;
}

export async function sendMail(to: string, subject: string, html: string) {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM ?? "School Management System <no-reply@sms.test>",
    to,
    subject,
    html,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    logger.info({ subject, to, previewUrl }, "Ethereal dev-mail preview link");
  }
  return info;
}
