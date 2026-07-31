import http from "node:http";
import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { apiRouter } from "./routes";
import { initSocket } from "./lib/socket";

const app = express();

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
