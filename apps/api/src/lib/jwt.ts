import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export const ACCESS_TOKEN_TTL = "15m";
export const REFRESH_TOKEN_TTL = "30d";
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface AccessTokenPayload {
  sub: string;
  schoolId: string;
  role: string;
}

export interface RefreshTokenPayload {
  sub: string;
  schoolId: string;
  jti: string;
}

export function signAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, env.jwtAccessSecret, { expiresIn: ACCESS_TOKEN_TTL });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload & jwt.JwtPayload;
}

export function signRefreshToken(payload: Omit<RefreshTokenPayload, "jti">) {
  const jti = randomUUID();
  const token = jwt.sign({ ...payload, jti }, env.jwtRefreshSecret, {
    expiresIn: REFRESH_TOKEN_TTL,
  });
  return { token, jti };
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.jwtRefreshSecret) as RefreshTokenPayload & jwt.JwtPayload;
}
