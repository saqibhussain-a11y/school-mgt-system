export interface DiarySection {
  id: string;
  name: string;
  classId: string;
  className: string;
}

interface DiaryAuthor {
  id: string;
  firstName: string;
  lastName: string;
}

export interface StaffDiaryEntry {
  id: string;
  date: string;
  content: string;
  photoUrl: string | null;
  createdAt: string;
  createdBy: DiaryAuthor;
  student: { id: string; firstName: string; lastName: string } | null;
  acknowledgedCount: number;
  recipientCount: number;
  canEdit: boolean;
}

export interface FamilyDiaryEntry {
  id: string;
  date: string;
  content: string;
  photoUrl: string | null;
  createdAt: string;
  createdBy: DiaryAuthor;
  isPersonal: boolean;
  acknowledged: boolean;
}

export interface Paginated<T> {
  data: T[];
  total: number;
}

// Diary dates are calendar days stored at UTC midnight — formatting in the
// viewer's timezone would show the previous day west of UTC.
export function formatDiaryDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function todayInputValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
