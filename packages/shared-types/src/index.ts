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
  // Set only when this session was minted by a Platform Admin's "view as
  // school admin" support action, not a real login — drives the
  // impersonation banner in DashboardShell.
  impersonatedBy?: string | null;
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
