export interface ExamSubjectSummary {
  id: string;
  maxMarks: number;
  subject: { id: string; name: string };
}

export interface ExamSummary {
  id: string;
  name: string;
  classId: string;
  academicSessionId: string;
  startDate: string;
  endDate: string;
  class: { id: string; name: string };
  academicSession: { id: string; name: string };
  examSubjects: ExamSubjectSummary[];
}
