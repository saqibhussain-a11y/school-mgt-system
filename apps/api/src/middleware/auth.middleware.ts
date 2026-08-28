import type { NextFunction, Request, Response } from "express";
import { Role, runWithTenant, runAsPlatform } from "@sms/db";
import { verifyAccessToken, verifyPlatformAccessToken } from "../lib/jwt";
import { HttpError } from "./errorHandler";

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new HttpError(401, "Missing bearer token");
  }

  try {
    req.user = verifyAccessToken(header.slice("Bearer ".length));
  } catch {
    throw new HttpError(401, "Invalid or expired access token");
  }

  runWithTenant(req.user.schoolId, next);
}

export function authenticatePlatform(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new HttpError(401, "Missing bearer token");
  }

  try {
    req.platformAdmin = verifyPlatformAccessToken(header.slice("Bearer ".length));
  } catch {
    throw new HttpError(401, "Invalid or expired access token");
  }

  runAsPlatform(next);
}

export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role as Role)) {
      throw new HttpError(403, "You do not have permission to perform this action");
    }
    next();
  };
}
