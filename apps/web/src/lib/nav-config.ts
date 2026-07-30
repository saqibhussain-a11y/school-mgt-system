import {
  LayoutDashboard,
  Megaphone,
  Users,
  UserCog,
  UsersRound,
  BookOpen,
  CalendarCheck,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@sms/shared-types";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: UserRole[];
}

const STAFF_ROLES: UserRole[] = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"];
const ADMIN_ROLES: UserRole[] = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"];

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Announcements", href: "/dashboard/announcements", icon: Megaphone },
  { label: "Students", href: "/dashboard/students", icon: Users, roles: STAFF_ROLES },
  { label: "Staff", href: "/dashboard/staff", icon: UserCog, roles: ADMIN_ROLES },
  { label: "Guardians", href: "/dashboard/guardians", icon: UsersRound, roles: STAFF_ROLES },
  { label: "Academics", href: "/dashboard/academics", icon: BookOpen },
  { label: "Attendance", href: "/dashboard/attendance", icon: CalendarCheck },
];

export function visibleNavItems(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
}
