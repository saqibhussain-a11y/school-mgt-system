import {
  LayoutDashboard,
  Megaphone,
  Users,
  UserCog,
  UsersRound,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  CalendarRange,
  GraduationCap,
  NotebookPen,
  ShieldCheck,
  Wallet,
  FileText,
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
// Everyone who can either apply for or review leave — PARENT is excluded,
// since parent-submitted leave-on-behalf-of-a-child isn't built yet.
const LEAVE_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "PRINCIPAL",
  "TEACHER",
  "ACCOUNTANT",
  "LIBRARIAN",
  "TRANSPORT_MANAGER",
  "STUDENT",
];

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Announcements", href: "/dashboard/announcements", icon: Megaphone },
  { label: "Students", href: "/dashboard/students", icon: Users, roles: STAFF_ROLES },
  { label: "Staff", href: "/dashboard/staff", icon: UserCog, roles: ADMIN_ROLES },
  { label: "Guardians", href: "/dashboard/guardians", icon: UsersRound, roles: STAFF_ROLES },
  { label: "Academics", href: "/dashboard/academics", icon: BookOpen },
  {
    label: "Timetable",
    href: "/dashboard/timetable",
    icon: CalendarRange,
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER", "STUDENT"],
  },
  { label: "Attendance", href: "/dashboard/attendance", icon: CalendarCheck },
  { label: "Leave", href: "/dashboard/leave", icon: CalendarClock, roles: LEAVE_ROLES },
  {
    label: "Exams",
    href: "/dashboard/exams",
    icon: GraduationCap,
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER", "STUDENT", "PARENT"],
  },
  {
    label: "Assignments",
    href: "/dashboard/assignments",
    icon: NotebookPen,
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER", "STUDENT", "PARENT"],
  },
  {
    label: "Fees",
    href: "/dashboard/fees",
    icon: Wallet,
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT", "STUDENT", "PARENT"],
  },
  {
    label: "Documents",
    href: "/dashboard/documents",
    icon: FileText,
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "STUDENT", "PARENT"],
  },
  {
    label: "School Admins",
    href: "/dashboard/school-admins",
    icon: ShieldCheck,
    roles: ["SUPER_ADMIN"],
  },
];

export function visibleNavItems(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
}
