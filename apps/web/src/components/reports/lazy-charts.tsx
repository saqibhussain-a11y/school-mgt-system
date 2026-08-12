"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// recharts is a meaningfully large dependency, and both consumers of these
// (the main dashboard and the reports page) render all three charts inside
// Tabs where only one is visible at a time — every visitor was paying for
// the full bundle on first load regardless of which tab (or none) they
// ever opened. `ssr: false` since these charts only ever render
// client-fetched data anyway (via useApi), so there's nothing for the
// server to usefully pre-render.
const loading = () => <Skeleton className="h-72 rounded-xl" />;

export const AttendanceTrendChart = dynamic(
  () => import("./attendance-trend-chart").then((m) => m.AttendanceTrendChart),
  { ssr: false, loading },
);

export const PerformanceTrendChart = dynamic(
  () => import("./performance-trend-chart").then((m) => m.PerformanceTrendChart),
  { ssr: false, loading },
);

export const FeeCollectionChart = dynamic(
  () => import("./fee-collection-chart").then((m) => m.FeeCollectionChart),
  { ssr: false, loading },
);
