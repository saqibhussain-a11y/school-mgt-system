export type UserRole =
  | "SCHOOL_ADMIN"
  | "PRINCIPAL"
  | "TEACHER"
  | "STUDENT"
  | "PARENT"
  | "ACCOUNTANT"
  | "LIBRARIAN"
  | "TRANSPORT_MANAGER";

export interface SchoolDto {
  id: string;
  name: string;
}

export interface PlatformSchoolDto {
  id: string;
  name: string;
  subdomain: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  createdAt: string;
}

export interface MeDto {
  id: string;
  email: string;
  role: UserRole;
  schoolId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  // Optional feature modules Platform Admin has turned on for this school
  // (e.g. "PAYROLL") — used only to render the Feature Modules settings
  // list (enabled vs not), not for nav filtering (see accessibleModules).
  enabledModules: string[];
  // enabledModules further narrowed to just the ones this user's role is
  // allowed to see (school-configurable per module, see the Feature
  // Modules settings tab) — this is what nav-config.ts's visibleNavItems()
  // actually filters on for module-gated nav items.
  accessibleModules: string[];
}

export interface ProfileDto {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone: string | null;
  address: string | null;
  avatarUrl: string | null;
}

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}
