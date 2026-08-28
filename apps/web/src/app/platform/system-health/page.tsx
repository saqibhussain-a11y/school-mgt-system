"use client";

import { Activity, AlertTriangle, Clock, Database, Gauge, Server } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlatformApi } from "@/lib/use-platform-api";

interface CheckResult {
  ok: boolean;
  latencyMs: number;
}

interface RequestWindow {
  requestCount: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  errorRatePercent: number;
  clientErrorRatePercent: number;
}

interface SystemHealth {
  db: CheckResult;
  redis: CheckResult;
  queue: { waiting: number; active: number; completed: number; failed: number; delayed: number };
  uptimeSeconds: number;
  requests: { last5min: RequestWindow; last60min: RequestWindow };
}

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function PlatformSystemHealthPage() {
  const { data, loading, refetch } = usePlatformApi<SystemHealth>("/api/platform/system-health");

  return (
    <div>
      <PageHeader
        title="System Health"
        description="A live snapshot, not a history — nothing here persists across a server restart"
        action={
          <Button variant="outline" size="sm" onClick={refetch}>
            Refresh
          </Button>
        }
      />

      {loading || !data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Database"
              value={data.db.ok ? "Operational" : "Down"}
              icon={Database}
              tone={data.db.ok ? "good" : "critical"}
              hint={`${data.db.latencyMs}ms`}
            />
            <StatCard
              label="Redis"
              value={data.redis.ok ? "Operational" : "Down"}
              icon={Server}
              tone={data.redis.ok ? "good" : "critical"}
              hint={`${data.redis.latencyMs}ms`}
            />
            <StatCard label="API uptime" value={formatUptime(data.uptimeSeconds)} icon={Clock} tone="primary" />
            <StatCard
              label="Requests (5 min)"
              value={data.requests.last5min.requestCount}
              icon={Activity}
              tone="primary"
            />
            <StatCard
              label="Avg / p95 latency (5 min)"
              value={`${data.requests.last5min.avgLatencyMs}ms / ${data.requests.last5min.p95LatencyMs}ms`}
              icon={Gauge}
              tone="primary"
            />
            <StatCard
              label="Error rate (5 min)"
              value={`${data.requests.last5min.errorRatePercent}%`}
              icon={AlertTriangle}
              tone={data.requests.last5min.errorRatePercent > 0 ? "warning" : "good"}
              hint={`${data.requests.last5min.clientErrorRatePercent}% client errors`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timetable generation queue</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-8">
              <Stat label="Waiting" value={data.queue.waiting} />
              <Stat label="Active" value={data.queue.active} />
              <Stat label="Completed" value={data.queue.completed} />
              <Stat label="Failed" value={data.queue.failed} tone={data.queue.failed > 0 ? "critical" : undefined} />
              <Stat label="Delayed" value={data.queue.delayed} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "critical" }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-xl font-semibold ${tone === "critical" && value > 0 ? "text-status-critical" : ""}`}>
        {value}
      </span>
    </div>
  );
}
