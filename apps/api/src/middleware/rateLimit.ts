import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// Keyed by IP (express-rate-limit's default) — proportionate to this app's
// scale. A distributed attacker rotating IPs defeats this; that's what the
// OTP-specific attempt cap in passwordReset.service.ts additionally guards
// against for /reset-password specifically.
const message = { error: "Too many attempts. Please wait a few minutes and try again." };

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message,
});

export const passwordResetRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message,
});

export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message,
});

// This endpoint is deliberately unauthenticated (a crashed frontend can't
// guarantee a valid token), so it's a plain open POST — this is the only
// thing standing between it and someone flooding the logs for free.
export const clientErrorReportLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message,
});

// Mints a real login-equivalent credential, so it gets login's own
// treatment — keyed per platform admin (authenticated already) rather than
// IP, since a shared office IP shouldn't throttle a different admin.
export const platformImpersonationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message,
  // Falls back to a normalized IP key (not raw req.ip) only for the
  // unreachable case where this runs before authenticatePlatform sets
  // req.platformAdmin — express-rate-limit requires IPv6 addresses go
  // through its own normalizer or they can bypass per-key limits.
  keyGenerator: (req) => req.platformAdmin?.sub ?? ipKeyGenerator(req.ip ?? "unknown"),
});
