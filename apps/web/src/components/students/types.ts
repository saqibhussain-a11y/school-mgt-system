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
