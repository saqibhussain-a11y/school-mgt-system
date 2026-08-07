import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth-context";
import type { SchoolClass } from "@/components/academics/classes-tab";

interface TeacherAssignmentRow {
  classId: string;
  class: { id: string; name: string };
}

// Shared by the Reports page and the dashboard's embedded report tabs — a
// teacher only ever sees their own assigned classes, everyone else sees all.
export function useReportClasses() {
  const { user } = useAuth();
  const isTeacher = user?.role === "TEACHER";

  const { data: allClasses } = useApi<SchoolClass[]>(!isTeacher ? "/api/classes" : null);
  const { data: myAssignments } = useApi<TeacherAssignmentRow[]>(
    isTeacher ? "/api/me/assignments" : null,
  );
  const teacherClasses = Array.from(
    new Map((myAssignments ?? []).map((a) => [a.classId, a.class])).values(),
  );
  const classes: { id: string; name: string }[] = isTeacher ? teacherClasses : (allClasses ?? []);

  return { classes, isTeacher };
}
