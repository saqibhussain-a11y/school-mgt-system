export interface AssignmentSummary {
  id: string;
  classId: string;
  subjectId: string;
  title: string;
  description: string | null;
  dueDate: string;
  maxMarks: number;
  attachmentFilename: string | null;
  createdAt: string;
  class: { id: string; name: string };
  subject: { id: string; name: string };
  createdBy: { id: string; firstName: string; lastName: string };
}

export interface SubmissionDetail {
  id: string;
  assignmentId: string;
  studentId: string;
  textAnswer: string | null;
  fileFilename: string | null;
  submittedAt: string;
  marksObtained: number | null;
  feedback: string | null;
  percentage: number | null;
  grade: string | null;
}
