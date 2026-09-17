"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Same reasoning as reports/lazy-charts.tsx — recharts only ever renders
// client-fetched dashboard data, so there's nothing for the server to
// pre-render, and splitting it out keeps it out of the initial bundle for
// any role that never sees these two admin-only widgets.
const loading = () => <Skeleton className="h-44 rounded-xl" />;

export const AttendanceBreakdownChart = dynamic(
  () => import("./attendance-breakdown-chart").then((m) => m.AttendanceBreakdownChart),
  { ssr: false, loading },
);

export const AdmissionsChart = dynamic(
  () => import("./admissions-chart").then((m) => m.AdmissionsChart),
  { ssr: false, loading },
);
