export interface ExamSessionSummary {
  id: string;
  name: string;
  academicSessionId: string;
  startDate: string;
  endDate: string;
  isAutoCreated: boolean;
  exams: { id: string; classId: string; class: { id: string; name: string } }[];
}
