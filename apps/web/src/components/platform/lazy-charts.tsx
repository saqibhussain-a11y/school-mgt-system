"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// recharts is a meaningfully large dependency — same rationale as the
// tenant reports page's lazy-charts.tsx.
const loading = () => <Skeleton className="h-72 rounded-xl" />;

export const GrowthChurnChart = dynamic(
  () => import("./growth-churn-chart").then((m) => m.GrowthChurnChart),
  { ssr: false, loading },
);

export const UsersByRoleChart = dynamic(
  () => import("./users-by-role-chart").then((m) => m.UsersByRoleChart),
  { ssr: false, loading },
);
