import { Server } from "socket.io";
import type { Server as HttpServer } from "node:http";
import { verifyAccessToken } from "./jwt";
import { env } from "../config/env";

let io: Server | null = null;

// Handshake auth mirrors the REST API's Bearer-token check (verifyAccessToken),
// just carried in `auth.token` instead of a header since the initial
// Socket.io handshake has no place to attach one from the browser client.
// A room per user (not per socket) means a signed-in user with multiple tabs
// gets the notification pushed to all of them.
export function initSocket(httpServer: HttpServer) {
  io = new Server(httpServer, { cors: { origin: env.corsOrigin } });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Missing auth token"));
    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.schoolId = payload.schoolId;
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.data.userId}`);
  });

  return io;
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}
