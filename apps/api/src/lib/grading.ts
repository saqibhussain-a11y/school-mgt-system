// Fixed percentage bands — the "percentage only" grading system chosen for
// this first pass (master doc also lists GPA and custom rubrics as later
// options; those would need a school-level config UI this doesn't build).
const BANDS: { min: number; grade: string }[] = [
  { min: 90, grade: "A" },
  { min: 75, grade: "B" },
  { min: 60, grade: "C" },
  { min: 40, grade: "D" },
  { min: 0, grade: "F" },
];

export function gradeFor(percentage: number): string {
  return BANDS.find((b) => percentage >= b.min)!.grade;
}
