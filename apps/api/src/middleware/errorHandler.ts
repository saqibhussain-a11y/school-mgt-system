import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@sms/db";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
}

function mapKnownError(err: unknown): { status: number; message: string } | null {
  if (err instanceof HttpError) {
    return { status: err.status, message: err.message };
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return { status: 409, message: "A record with these details already exists" };
    }
    if (err.code === "P2025") {
      return { status: 404, message: "Record not found" };
    }
  }
  return null;
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const mapped = mapKnownError(err);
  const status = mapped?.status ?? 500;
  // Anything not explicitly mapped above is an unexpected failure — its raw
  // message (a Prisma validation error naming a column/table, a bare
  // exception message, etc.) is an implementation detail, not something
  // safe to hand back to a client probing endpoints with malformed input.
  // Every mapped message above was written to be user-facing on purpose.
  const message = mapped?.message ?? "Internal server error";

  if (status === 500) {
    console.error(err);
  }

  res.status(status).json({ error: message });
}
