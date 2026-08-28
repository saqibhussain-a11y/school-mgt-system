import type { AccessTokenPayload, PlatformAccessTokenPayload } from "../lib/jwt";

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
      platformAdmin?: PlatformAccessTokenPayload;
    }
  }
}

export {};
