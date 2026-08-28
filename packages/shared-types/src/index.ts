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
