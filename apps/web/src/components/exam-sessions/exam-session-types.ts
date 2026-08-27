export type SeatingStrategy = "INTERLEAVED" | "COLUMN_BLOCKED";

export interface ExamSessionSummary {
  id: string;
  name: string;
  academicSessionId: string;
  startDate: string;
  endDate: string;
  isAutoCreated: boolean;
  seatingStrategy: SeatingStrategy;
  exams: { id: string; classId: string; class: { id: string; name: string } }[];
}
