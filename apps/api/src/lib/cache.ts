import { redis } from "./redis";
import { logger } from "./logger";

// Redis is a speed-up, never a dependency for correctness — if it's down or
// a GET/SET call errors, every one of these falls through to computing the
// value directly rather than surfacing a 500 for what should be a cache miss.
export async function getOrSet<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
  try {
    const cached = await redis.get(key);
    if (cached !== null) return JSON.parse(cached) as T;
  } catch (err) {
    logger.warn({ err, key }, "Cache read failed — computing directly");
  }

  const value = await compute();

  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    logger.warn({ err, key }, "Cache write failed");
  }

  return value;
}

// Best-effort invalidation for the handful of writes that happen to touch a
// cache key directly (e.g. an admin editing a fee structure). Most keys here
// are left to expire on their own short TTL instead — see each call site.
export async function invalidate(...keys: string[]) {
  if (keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch (err) {
    logger.warn({ err, keys }, "Cache invalidation failed");
  }
}
