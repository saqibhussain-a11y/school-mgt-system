import type { NextFunction, Request, Response } from "express";

interface RequestSample {
  timestamp: number;
  statusCode: number;
  durationMs: number;
}

// In-memory only — resets on restart, by design (no external APM, no DB
// persistence for this pass). A fixed-size ring buffer bounds memory use
// regardless of traffic volume.
const RING_SIZE = 2000;
const samples: RequestSample[] = [];
let writeIndex = 0;

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const sample = { timestamp: Date.now(), statusCode: res.statusCode, durationMs };
    if (samples.length < RING_SIZE) {
      samples.push(sample);
    } else {
      samples[writeIndex] = sample;
      writeIndex = (writeIndex + 1) % RING_SIZE;
    }
  });
  next();
}

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Math.round(sorted[Math.max(0, idx)]);
}

function summarize(windowMs: number) {
  const cutoff = Date.now() - windowMs;
  const inWindow = samples.filter((s) => s.timestamp >= cutoff);
  const durations = inWindow.map((s) => s.durationMs).sort((a, b) => a - b);
  const errorCount = inWindow.filter((s) => s.statusCode >= 500).length;
  const clientErrorCount = inWindow.filter((s) => s.statusCode >= 400 && s.statusCode < 500).length;

  return {
    requestCount: inWindow.length,
    avgLatencyMs: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
    p95LatencyMs: percentile(durations, 95),
    errorRatePercent: inWindow.length ? Math.round((errorCount / inWindow.length) * 1000) / 10 : 0,
    clientErrorRatePercent: inWindow.length ? Math.round((clientErrorCount / inWindow.length) * 1000) / 10 : 0,
  };
}

export const metrics = {
  getRollup() {
    return {
      last5min: summarize(5 * 60 * 1000),
      last60min: summarize(60 * 60 * 1000),
    };
  },
};
