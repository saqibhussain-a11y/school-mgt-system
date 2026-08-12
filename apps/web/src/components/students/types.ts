export interface StudentSummary {
  id: string;
  admissionNo: string;
  dob: string;
  admissionDate: string;
  status: "ACTIVE" | "WITHDRAWN";
  classId: string;
  sectionId: string;
  previousSchool: string | null;
  medicalInfo: string | null;
  user: { id: string; email: string; firstName: string; lastName: string; role: string };
  class: { id: string; name: string };
  section: { id: string; name: string };
}

// GET /api/students/:id only — the list endpoint dropped this nested
// guardian.guardian.user relation (unused by every list/roster consumer) to
// cut payload size on the one call site that has no classId/sectionId
// filter and can return the whole school's roster at once.
export interface StudentDetail extends StudentSummary {
  guardians: {
    id: string;
    relationshipType: string;
    isPrimaryContact: boolean;
    guardian: {
      id: string;
      user: { firstName: string; lastName: string; email: string };
    };
  }[];
}
