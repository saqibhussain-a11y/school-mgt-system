import http from "node:http";
import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { apiRouter } from "./routes";
import { initSocket } from "./lib/socket";

const app = express();

// One reverse-proxy hop in front of this process in every deployed
// environment (Docker/Nginx on Railway/Render) — without this, express-rate-limit
// keys every request off the proxy's IP, putting all traffic in one bucket.
if (env.nodeEnv === "production") {
  app.set("trust proxy", 1);
}

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

app.use("/api", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const httpServer = http.createServer(app);
initSocket(httpServer);

httpServer.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
});
