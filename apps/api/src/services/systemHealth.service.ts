import { prisma } from "@sms/db";
import { redis } from "../lib/redis";
import { timetableGenerationQueue } from "../lib/queue";
import { metrics } from "../lib/metrics";
import { logger } from "../lib/logger";

async function timed<T>(fn: () => Promise<T>): Promise<{ ok: boolean; latencyMs: number }> {
  const start = process.hrtime.bigint();
  try {
    await fn();
    return { ok: true, latencyMs: Math.round(Number(process.hrtime.bigint() - start) / 1_000_000) };
  } catch (err) {
    logger.error({ err }, "System health check failed");
    return { ok: false, latencyMs: Math.round(Number(process.hrtime.bigint() - start) / 1_000_000) };
  }
}

export const systemHealthService = {
  async getStatus() {
    const [db, redisCheck, jobCounts] = await Promise.all([
      timed(() => prisma.$queryRaw`SELECT 1`),
      timed(() => redis.ping()),
      timetableGenerationQueue.getJobCounts("waiting", "active", "completed", "failed", "delayed"),
    ]);

    return {
      db,
      redis: redisCheck,
      queue: jobCounts,
      uptimeSeconds: Math.round(process.uptime()),
      requests: metrics.getRollup(),
    };
  },
};
