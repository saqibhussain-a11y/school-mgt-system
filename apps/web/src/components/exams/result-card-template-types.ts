export interface Marker {
  id: string;
  fieldKey: string;
  xRatio: number;
  yRatio: number;
  fontSize?: number;
}

export interface ResultCardTemplate {
  id: string;
  imageKey: string;
  imageFilename: string;
  imageUrl: string;
  markers: Marker[];
}

export const FIXED_FIELDS: { key: string; label: string }[] = [
  { key: "studentName", label: "Student Name" },
  { key: "admissionNo", label: "Admission No." },
  { key: "className", label: "Class" },
  { key: "examName", label: "Exam Name" },
  { key: "overallPercentage", label: "Overall %" },
  { key: "overallGrade", label: "Overall Grade" },
  { key: "rank", label: "Rank" },
];

export function labelForFieldKey(fieldKey: string): string {
  const fixed = FIXED_FIELDS.find((f) => f.key === fieldKey);
  if (fixed) return fixed.label;
  const match = fieldKey.match(/^subject(Obtained|Total):(\d+)$/);
  if (match) return `Subject ${match[2]} — ${match[1]}`;
  return fieldKey;
}

export function subjectSlotNumbers(markers: Marker[]): number[] {
  const slots = new Set<number>();
  for (const m of markers) {
    const match = m.fieldKey.match(/^subject(?:Obtained|Total):(\d+)$/);
    if (match) slots.add(Number(match[1]));
  }
  return Array.from(slots).sort((a, b) => a - b);
}
