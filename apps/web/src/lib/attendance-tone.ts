export function attendanceTone(percent: number): "good" | "warning" | "critical" {
  if (percent >= 90) return "good";
  if (percent >= 75) return "warning";
  return "critical";
}
