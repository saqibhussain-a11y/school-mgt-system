// Must load before any other import — @sms/db's client module reads
// process.env.DATABASE_URL at top-level module-evaluation time, so if it's
// imported (even transitively) before dotenv has populated process.env,
// Prisma silently falls back to the ambient environment's own Postgres
// defaults instead of this project's .env value. Caught live: adding
// `import { prisma } from "@sms/db"` below, for graceful shutdown, put
// that read before config/env.ts's dotenv/config side effect and broke
// every DB call in the process with "database `dev` does not exist".
import "dotenv/config";
import http from "node:http";
import compression from "compression";
import cors from "cors";
import express from "express";
import pinoHttp from "pino-http";
import { prisma } from "@sms/db";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { apiRouter } from "./routes";
import { initSocket, closeSocket } from "./lib/socket";
import { closeRedis } from "./lib/redis";
import { closeQueues } from "./lib/queue";
import { startWorkers, closeWorkers } from "./lib/worker";

const app = express();

// One reverse-proxy hop in front of this process in every deployed
// environment (Docker/Nginx on Railway/Render) — without this, express-rate-limit
// keys every request off the proxy's IP, putting all traffic in one bucket.
if (env.nodeEnv === "production") {
  app.set("trust proxy", 1);
}

// Emitted on response finish, not request start — req.user is already
// populated by then (authenticate middleware runs before the handler
// completes), so every request line carries who made it and which
// school/tenant it belongs to, not just method+path+status.
app.use(
  pinoHttp({
    logger,
    customProps: (req) => ({
      schoolId: req.user?.schoolId,
      userId: req.user?.sub,
      role: req.user?.role,
    }),
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
  }),
);

app.use(compression());
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

app.use("/api", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const httpServer = http.createServer(app);
initSocket(httpServer);
startWorkers();

httpServer.listen(env.port, () => {
  logger.info(`API listening on http://localhost:${env.port}`);
});

// A PaaS redeploy/restart sends SIGTERM — without a handler, Node's default
// is to terminate immediately, killing in-flight requests mid-response and
// tearing down the Prisma pool and any open sockets abruptly instead of
// draining them. closeSocket() closes socket.io, which — since it wraps
// this same httpServer instance — also stops it accepting new connections
// and waits for in-flight requests to finish; a separate httpServer.close()
// call after it would throw ERR_SERVER_NOT_RUNNING (caught live: the server
// was already closed by the time that second call ran).
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down gracefully");

  const forceExit = setTimeout(() => {
    logger.warn("Graceful shutdown timed out — forcing exit");
    process.exit(1);
  }, 10_000);

  try {
    await closeSocket();
    await closeWorkers();
    await closeQueues();
    await prisma.$disconnect();
    await closeRedis();
    clearTimeout(forceExit);
    logger.info("Shutdown complete");
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "Error during shutdown");
    clearTimeout(forceExit);
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Node's own default for either of these is to crash the process anyway
// (unhandledRejection has crashed by default since Node 15) — the point
// here isn't to survive, it's to log through our structured logger instead
// of losing the error to a bare stderr dump with no request/tenant context,
// before letting the platform restart the process the same way it would
// have regardless.
process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception — exiting");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled rejection — exiting");
  process.exit(1);
});
