import { LayoutDashboard, Building2, ScrollText, BarChart3, Activity } from "lucide-react";
import type { NavItem } from "./nav-config";

// Flat — five items doesn't need the expand/collapse machinery the tenant
// sidebar's Academics/Exams sections needed, and there's no per-role
// filtering (a platform admin has no roles).
export const PLATFORM_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/platform", icon: LayoutDashboard },
  { label: "Schools", href: "/platform/schools", icon: Building2 },
  { label: "Reports", href: "/platform/reports", icon: BarChart3 },
  { label: "System Health", href: "/platform/system-health", icon: Activity },
  { label: "Audit Log", href: "/platform/audit-log", icon: ScrollText },
];
