"use client";

import { StaffDiaryView } from "@/components/diary/staff-diary-view";
import { FamilyDiaryView } from "@/components/diary/family-diary-view";
import { useAuth } from "@/lib/auth-context";

const STAFF_ROLES = ["SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"];

export default function DiaryPage() {
  const { user } = useAuth();
  if (!user) return null;
  return STAFF_ROLES.includes(user.role) ? <StaffDiaryView /> : <FamilyDiaryView />;
}
