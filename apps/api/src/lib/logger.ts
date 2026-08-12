import pino from "pino";
import { env } from "../config/env";

// Pretty, human-readable output in dev; structured JSON everywhere else
// (Railway/Render capture stdout as text — a JSON line per log event is
// what makes that greppable/filterable at all, versus a bare
// console.log/error string with no level, timestamp, or request context).
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (env.nodeEnv === "production" ? "info" : "debug"),
  transport:
    env.nodeEnv === "production"
      ? undefined
      : { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" } },
});
