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
  ListTree,
  Camera,
  Wallet,
  FileText,
  BarChart3,
  Library,
  Bus,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@sms/shared-types";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: UserRole[];
  children?: NavItem[];
}

const STAFF_ROLES: UserRole[] = ["SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"];
const ADMIN_ROLES: UserRole[] = ["SCHOOL_ADMIN", "PRINCIPAL"];
const LEAVE_ROLES: UserRole[] = [
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
  {
    label: "Academics",
    href: "/dashboard/academics/sessions",
    icon: BookOpen,
    children: [
      { label: "Sessions", href: "/dashboard/academics/sessions", icon: BookOpen },
      { label: "Classes", href: "/dashboard/academics/classes", icon: BookOpen },
      { label: "Sections", href: "/dashboard/academics/sections", icon: BookOpen },
      { label: "Subjects", href: "/dashboard/academics/subjects", icon: BookOpen },
      { label: "Rooms", href: "/dashboard/academics/rooms", icon: BookOpen },
      { label: "Periods", href: "/dashboard/academics/periods", icon: BookOpen },
    ],
  },
  {
    label: "Timetable",
    href: "/dashboard/timetable",
    icon: CalendarRange,
    roles: ["SCHOOL_ADMIN", "PRINCIPAL", "TEACHER", "STUDENT"],
  },
  {
    label: "Curriculum",
    href: "/dashboard/curriculum",
    icon: ListTree,
    roles: ["SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"],
  },
  { label: "Attendance", href: "/dashboard/attendance", icon: CalendarCheck },
  {
    label: "Staff Attendance",
    href: "/dashboard/staff-attendance",
    icon: Camera,
    roles: ["SCHOOL_ADMIN", "PRINCIPAL", "TEACHER", "ACCOUNTANT", "LIBRARIAN", "TRANSPORT_MANAGER"],
  },
  { label: "Leave", href: "/dashboard/leave", icon: CalendarClock, roles: LEAVE_ROLES },
  {
    label: "Exams",
    href: "/dashboard/exams",
    icon: GraduationCap,
    roles: ["SCHOOL_ADMIN", "PRINCIPAL", "TEACHER", "STUDENT", "PARENT"],
    children: [
      { label: "Exam Sessions", href: "/dashboard/exams/sessions", icon: GraduationCap, roles: STAFF_ROLES },
      { label: "My Duties", href: "/dashboard/exams/duties", icon: GraduationCap, roles: STAFF_ROLES },
      {
        label: "Result Card Template",
        href: "/dashboard/exams/template",
        icon: GraduationCap,
        roles: ADMIN_ROLES,
      },
    ],
  },
  {
    label: "Assignments",
    href: "/dashboard/assignments",
    icon: NotebookPen,
    roles: ["SCHOOL_ADMIN", "PRINCIPAL", "TEACHER", "STUDENT", "PARENT"],
  },
  {
    label: "Fees",
    href: "/dashboard/fees",
    icon: Wallet,
    roles: ["SCHOOL_ADMIN", "PRINCIPAL", "ACCOUNTANT", "STUDENT", "PARENT"],
  },
  {
    label: "Documents",
    href: "/dashboard/documents",
    icon: FileText,
    roles: ["SCHOOL_ADMIN", "PRINCIPAL", "STUDENT", "PARENT"],
  },
  {
    label: "Library",
    href: "/dashboard/library",
    icon: Library,
    roles: ["SCHOOL_ADMIN", "PRINCIPAL", "LIBRARIAN", "STUDENT", "PARENT"],
  },
  {
    label: "Transport",
    href: "/dashboard/transport",
    icon: Bus,
    roles: ["SCHOOL_ADMIN", "PRINCIPAL", "TRANSPORT_MANAGER", "STUDENT", "PARENT"],
  },
  {
    label: "Reports",
    href: "/dashboard/reports",
    icon: BarChart3,
    roles: ["SCHOOL_ADMIN", "PRINCIPAL", "TEACHER", "ACCOUNTANT"],
  },
];

export function visibleNavItems(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role)).map((item) => {
    if (!item.children) return item;
    const children = item.children.filter((child) => !child.roles || child.roles.includes(role));
    return children.length > 0 ? { ...item, children } : { ...item, children: undefined };
  });
}
