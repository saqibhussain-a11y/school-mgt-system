export interface ExamSubjectSummary {
  id: string;
  maxMarks: number;
  subject: { id: string; name: string };
}

export interface DatesheetExamSubjectSummary {
  id: string;
  maxMarks: number;
  examDate: string | null;
  startTime: string | null;
  endTime: string | null;
  subject: { id: string; name: string };
}

export interface ExamSummary {
  id: string;
  name: string;
  classId: string;
  academicSessionId: string;
  examSessionId: string | null;
  startDate: string;
  endDate: string;
  class: { id: string; name: string };
  academicSession: { id: string; name: string };
  examSubjects: DatesheetExamSubjectSummary[];
}
