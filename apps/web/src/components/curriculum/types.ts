export interface SyllabusSummary {
  id: string;
  classId: string;
  subjectId: string;
  academicSessionId: string;
  class: { id: string; name: string };
  subject: { id: string; name: string };
  academicSession: { id: string; name: string };
}

export interface ScheduleEntrySummary {
  id: string;
  chapterId: string;
  startDate: string;
  endDate: string;
}

export interface ChapterSummary {
  id: string;
  syllabusId: string;
  title: string;
  order: number;
  scheduleEntries: ScheduleEntrySummary[];
}

export interface SyllabusDetail extends SyllabusSummary {
  chapters: ChapterSummary[];
}
