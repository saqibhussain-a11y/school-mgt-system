import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export interface TimetableSlotSummary {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  class: { id: string; name: string };
  section: { id: string; name: string };
  subject: { id: string; name: string };
  staff: { id: string; user: { firstName: string; lastName: string } };
}

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const DAY_LABELS: Record<string, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
};

export function TimetableGrid({
  slots,
  showClassSection,
  renderActions,
}: {
  slots: TimetableSlotSummary[];
  showClassSection?: boolean;
  renderActions?: (slot: TimetableSlotSummary) => ReactNode;
}) {
  const byDay: Record<string, TimetableSlotSummary[]> = {};
  for (const slot of slots) {
    (byDay[slot.dayOfWeek] ??= []).push(slot);
  }
  for (const day of DAYS) {
    byDay[day]?.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {DAYS.map((day) => (
        <div key={day} className="flex flex-col gap-2">
          <div className="text-sm font-semibold text-muted-foreground">{DAY_LABELS[day]}</div>
          {(byDay[day] ?? []).length === 0 ? (
            <div className="text-xs text-muted-foreground">No classes</div>
          ) : (
            (byDay[day] ?? []).map((slot) => (
              <Card key={slot.id} className="p-3">
                <div className="text-xs text-muted-foreground">
                  {slot.startTime} – {slot.endTime}
                </div>
                <div className="text-sm font-medium">{slot.subject.name}</div>
                <div className="text-xs text-muted-foreground">
                  {slot.staff.user.firstName} {slot.staff.user.lastName}
                </div>
                {showClassSection && (
                  <div className="text-xs text-muted-foreground">
                    {slot.class.name} – {slot.section.name}
                  </div>
                )}
                {renderActions && <div className="mt-2 flex gap-1">{renderActions(slot)}</div>}
              </Card>
            ))
          )}
        </div>
      ))}
    </div>
  );
}
