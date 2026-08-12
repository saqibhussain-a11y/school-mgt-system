import Redis from "ioredis";
import { env } from "../config/env";
import { logger } from "./logger";

// One shared connection for both the cache helper and BullMQ. BullMQ needs
// maxRetriesPerRequest: null on any connection it's handed (its docs call
// this out explicitly) — set globally here rather than on a second,
// separately-configured client.
export const redis = new Redis(env.redisUrl, { maxRetriesPerRequest: null });

redis.on("error", (err) => {
  logger.error({ err }, "Redis connection error");
});

export async function closeRedis() {
  await redis.quit();
}
