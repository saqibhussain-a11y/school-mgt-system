import { randomInt } from "crypto";

export const OTP_TTL_MS = 10 * 60 * 1000;

export function generateOtp() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}
