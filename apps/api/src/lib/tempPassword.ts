import { randomInt } from "crypto";

const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";

export function generateTempPassword(length = 12) {
  let password = "";
  for (let i = 0; i < length; i++) {
    password += CHARSET[randomInt(0, CHARSET.length)];
  }
  return password;
}
