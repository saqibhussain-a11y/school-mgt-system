export type UserRole =
  | "SUPER_ADMIN"
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
  subdomain: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
}
